// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IXChainController.sol";
import "./Interfaces/IGame.sol";
import "./Interfaces/ExternalInterfaces/IConnext.sol";
import "./Interfaces/ExternalInterfaces/IXReceiver.sol";

contract XProvider is IXReceiver {
  using SafeERC20 for IERC20;

  address public immutable connext;

  address private dao;
  address private guardian;
  address public xController;
  address public xControllerProvider;
  address public game;

  uint32 public homeChain;
  uint32 public xControllerChain;
  uint32 public gameChain;

  // (domainID => contract address) mapping domainIDs to trusted remote xProvider on that specific domain
  mapping(uint32 => address) public trustedRemoteConnext;
  // (vaultAddress => bool): used for whitelisting vaults
  mapping(address => bool) public vaultWhitelist;
  // (vaultNumber => vaultAddress): used for guardian when xCall fails
  mapping(uint256 => address) public vaults;

  event SetTrustedRemote(uint32 _srcChainId, bytes _srcAddress);
  event SetTrustedRemoteConnext(uint32 _srcChainId, address _srcAddress);

  modifier onlyDao() {
    require(msg.sender == dao, "xProvider: only DAO");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "only Guardian");
    _;
  }

  modifier onlyController() {
    require(msg.sender == xController, "xProvider: only Controller");
    _;
  }

  modifier onlyVaults() {
    require(vaultWhitelist[msg.sender], "xProvider: only vault");
    _;
  }

  modifier onlyGame() {
    require(msg.sender == game, "xProvider: only Game");
    _;
  }

  /// @notice Solution for the low-level call in xReceive that is seen as an external call
  modifier onlySelf() {
    require(msg.sender == address(this), "xProvider: only Self");
    _;
  }

  modifier onlySelfOrVault() {
    require(
      msg.sender == address(this) || vaultWhitelist[msg.sender],
      "xProvider: only Self or Vault"
    );
    _;
  }

  /** @notice A modifier for authenticated calls.
   * This is an important security consideration. If the target contract
   * function should be authenticated, it must check three things:
   *    1) The originating call comes from the expected origin domain.
   *    2) The originating call comes from the expected source contract.
   *    3) The call to this contract comes from Connext.
   */
  modifier onlySource(address _originSender, uint32 _origin) {
    require(_originSender == trustedRemoteConnext[_origin] && msg.sender == connext, "Not trusted");
    _;
  }

  constructor(
    address _connext,
    address _dao,
    address _guardian,
    address _game,
    address _xController,
    uint32 _homeChain
  ) {
    connext = _connext;
    dao = _dao;
    guardian = _guardian;
    game = _game;
    xController = _xController;
    homeChain = _homeChain;
  }

  /// @notice Function to send function selectors crossChain
  /// @param _destinationDomain chain Id of destination chain
  /// @param _callData Function selector to call on receiving chain with params
  /// @param _relayerFee The fee offered to the relayers, if 0 use the complete msg.value
  function xSend(uint32 _destinationDomain, bytes memory _callData, uint256 _relayerFee) internal {
    address target = trustedRemoteConnext[_destinationDomain];
    require(target != address(0), "XProvider: destination chain not trusted");
    uint256 relayerFee = _relayerFee != 0 ? _relayerFee : msg.value;

    IConnext(connext).xcall{value: relayerFee}(
      _destinationDomain, // _destination: Domain ID of the destination chain
      target, // _to: address of the target contract
      address(0), // _asset: use address zero for 0-value transfers
      msg.sender, // _delegate: address that can revert or forceLocal on destination
      0, // _amount: 0 because no funds are being transferred
      0, // _slippage: can be anything between 0-10000 because no funds are being transferred
      _callData // _callData: the encoded calldata to send
    );
  }

  /// @notice Transfers funds from one chain to another.
  /// @param _token Address of the token on this domain.
  /// @param _amount The amount to transfer.
  /// @param _recipient The destination address (e.g. a wallet).
  /// @param _destinationDomain The destination domain ID.
  /// @param _slippage Slippage tollerance for xChain swap, in BPS (i.e. 30 = 0.3%)
  /// @param _relayerFee The fee offered to the relayers for confirmation message, msg.value - _relayerFee is what goes to the routers
  function xTransfer(
    address _token,
    uint256 _amount,
    address _recipient,
    uint32 _destinationDomain,
    uint256 _slippage,
    uint256 _relayerFee
  ) internal {
    require(
      IERC20(_token).allowance(msg.sender, address(this)) >= _amount,
      "User must approve amount"
    );

    // User sends funds to this contract
    IERC20(_token).transferFrom(msg.sender, address(this), _amount);

    // This contract approves transfer to Connext
    IERC20(_token).approve(address(connext), _amount);

    IConnext(connext).xcall{value: (msg.value - _relayerFee)}(
      _destinationDomain, // _destination: Domain ID of the destination chain
      _recipient, // _to: address receiving the funds on the destination
      _token, // _asset: address of the token contract
      msg.sender, // _delegate: address that can revert or forceLocal on destination
      _amount, // _amount: amount of tokens to transfer
      _slippage, // _slippage: the maximum amount of slippage the user will accept in BPS (e.g. 30 = 0.3%)
      bytes("") // _callData: empty bytes because we're only sending funds
    );
  }

  /// @notice function implemented from IXReceive from connext, standard way to receive messages with connext.
  /// @param _transferId not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _amount not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _asset not used here because only relevant in case of a value transfer. Still in the signature to comply with IXReceive.
  /// @param _originSender sender contract.
  /// @param _origin sender domain id.
  /// @param _callData calldata, contains function signature which has to be called in this contract as well as the values, hashed and encoded.
  function xReceive(
    bytes32 _transferId,
    uint256 _amount,
    address _asset,
    address _originSender,
    uint32 _origin,
    bytes memory _callData
  ) external onlySource(_originSender, _origin) returns (bytes memory) {
    (bool success, ) = address(this).call(_callData);
    require(success, "xReceive: No success");
  }

  /// @notice Step 1 push; Game pushes totalDeltaAllocations to xChainController
  /// @notice Pushes the delta allocations from the game to the xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function pushAllocations(
    uint256 _vaultNumber,
    int256[] memory _deltas
  ) external payable onlyGame {
    if (homeChain == xControllerChain) {
      return IXChainController(xController).receiveAllocationsFromGame(_vaultNumber, _deltas);
    }
    bytes4 selector = bytes4(keccak256("receiveAllocations(uint256,int256[])"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _deltas);

    xSend(xControllerChain, callData, 0);
  }

  /// @notice Step 1 receive; Game pushes totalDeltaAllocations to xChainController
  /// @notice Receives the delta allocations from the game and routes to xChainController
  /// @param _vaultNumber number of the vault
  /// @param _deltas Array with delta Allocations for all chainIds
  function receiveAllocations(uint256 _vaultNumber, int256[] memory _deltas) external onlySelf {
    return IXChainController(xController).receiveAllocationsFromGame(_vaultNumber, _deltas);
  }

  /// @notice Step 2 push; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Pushes cross chain requests for the totalUnderlying for a vaultNumber on a chainId
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying TotalUnderling plus vault balance in vaultcurrency e.g USDC
  /// @param _totalSupply Supply of the LP token of the vault on given chainId
  /// @param _withdrawalRequests Total amount of withdrawal requests from the vault in LP Tokens
  function pushTotalUnderlying(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external payable onlyVaults {
    if (_chainId == xControllerChain) {
      return
        IXChainController(xController).setTotalUnderlying(
          _vaultNumber,
          _chainId,
          _underlying,
          _totalSupply,
          _withdrawalRequests
        );
    } else {
      bytes4 selector = bytes4(
        keccak256("receiveTotalUnderlying(uint256,uint32,uint256,uint256,uint256)")
      );
      bytes memory callData = abi.encodeWithSelector(
        selector,
        _vaultNumber,
        _chainId,
        _underlying,
        _totalSupply,
        _withdrawalRequests
      );

      xSend(xControllerChain, callData, 0);
    }
  }

  /// @notice Step 2 receive; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Receive and set totalUnderlyings from the vaults for every chainId
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying TotalUnderling plus vault balance in vaultcurrency e.g USDC
  /// @param _totalSupply Supply of the LP token of the vault on given chainId
  /// @param _withdrawalRequests Total amount of withdrawal requests from the vault in LP Tokens
  function receiveTotalUnderlying(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external onlySelf {
    return
      IXChainController(xController).setTotalUnderlying(
        _vaultNumber,
        _chainId,
        _underlying,
        _totalSupply,
        _withdrawalRequests
      );
  }

  /// @notice Step 3 push; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  /// @param _amountToSendBack Amount the vault has to send back
  /// @param _exchangeRate New exchangerate for vaults
  function pushSetXChainAllocation(
    address _vault,
    uint32 _chainId,
    uint256 _amountToSendBack,
    uint256 _exchangeRate,
    bool _receivingFunds
  ) external payable onlyController {
    if (_chainId == homeChain) {
      return IVault(_vault).setXChainAllocation(_amountToSendBack, _exchangeRate, _receivingFunds);
    } else {
      bytes4 selector = bytes4(
        keccak256("receiveSetXChainAllocation(address,uint256,uint256,bool)")
      );
      bytes memory callData = abi.encodeWithSelector(
        selector,
        _vault,
        _amountToSendBack,
        _exchangeRate,
        _receivingFunds
      );

      xSend(_chainId, callData, 0);
    }
  }

  /// @notice Step 3 receive; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _amountToSendBack Amount the vault has to send back
  /// @param _exchangeRate New exchangerate for vaults
  function receiveSetXChainAllocation(
    address _vault,
    uint256 _amountToSendBack,
    uint256 _exchangeRate,
    bool _receivingFunds
  ) external onlySelf {
    return IVault(_vault).setXChainAllocation(_amountToSendBack, _exchangeRate, _receivingFunds);
  }

  /// @notice Step 4 push; Push funds from vaults to xChainController
  /// @notice Transfers funds from vault to xController for crosschain rebalance
  /// @param _vaultNumber Address of the Derby Vault on given chainId
  /// @param _amount Number of the vault
  /// @param _asset Address of the token to send e.g USDC
  /// @param _slippage Slippage tollerance for xChain swap, in BPS (i.e. 30 = 0.3%)
  /// @param _relayerFee The fee offered to the relayers
  function xTransferToController(
    uint256 _vaultNumber,
    uint256 _amount,
    address _asset,
    uint256 _slippage,
    uint256 _relayerFee
  ) external payable onlyVaults {
    if (homeChain == xControllerChain) {
      IERC20(_asset).transferFrom(msg.sender, xController, _amount);
      IXChainController(xController).upFundsReceived(_vaultNumber);
    } else {
      xTransfer(_asset, _amount, xController, xControllerChain, _slippage, _relayerFee);
      pushFeedbackToXController(_vaultNumber, _relayerFee);
    }
  }

  /// @notice Step 4 push; Push funds from vaults to xChainController
  /// @notice Push crosschain feedback to xController to know when the vaultNumber has sent funds
  /// @param _vaultNumber Number of the vault
  /// @param _relayerFee The fee offered to the relayers
  function pushFeedbackToXController(uint256 _vaultNumber, uint256 _relayerFee) internal {
    bytes4 selector = bytes4(keccak256("receiveFeedbackToXController(uint256)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber);

    xSend(xControllerChain, callData, _relayerFee);
  }

  /// @notice Step 4 receive; Push funds from vaults to xChainController
  /// @notice Receive crosschain feedback to xController to know when the vaultNumber has sent funds
  /// @param _vaultNumber Number of the vault
  function receiveFeedbackToXController(uint256 _vaultNumber) external onlySelf {
    return IXChainController(xController).upFundsReceived(_vaultNumber);
  }

  /// @notice Step 5 push; Push funds from xChainController to vaults
  /// @notice Transfers funds from xController to vault for crosschain rebalance
  /// @param _chainId Number of chainId
  /// @param _amount Amount to send to vault in vaultcurrency
  /// @param _asset Addres of underlying e.g USDC
  /// @param _slippage Slippage tollerance for xChain swap, in BPS (i.e. 30 = 0.3%)
  /// @param _relayerFee The fee offered to the relayers
  function xTransferToVaults(
    address _vault,
    uint32 _chainId,
    uint256 _amount,
    address _asset,
    uint256 _slippage,
    uint256 _relayerFee
  ) external payable onlyController {
    if (_chainId == homeChain) {
      IVault(_vault).receiveFunds();
      IERC20(_asset).transferFrom(msg.sender, _vault, _amount);
    } else {
      pushFeedbackToVault(_chainId, _vault, _relayerFee);
      xTransfer(_asset, _amount, _vault, _chainId, _slippage, _relayerFee);
    }
  }

  /// @notice Step 5 push; Push funds from xChainController to vaults
  /// @notice Push feedback message so the vault knows it has received funds and is ready to rebalance
  /// @param _chainId Number of chainId
  /// @param _vault Address of the vault on given chainId
  /// @param _relayerFee The fee offered to the relayers
  function pushFeedbackToVault(uint32 _chainId, address _vault, uint256 _relayerFee) internal {
    bytes4 selector = bytes4(keccak256("receiveFeedbackToVault(address)"));
    bytes memory callData = abi.encodeWithSelector(selector, _vault);

    xSend(_chainId, callData, _relayerFee);
  }

  /// @notice Step 5 receive; Push funds from xChainController to vaults
  /// @notice Receive feedback message so the vault knows it has received funds and is ready to rebalance
  /// @param _vault Address of the vault on given chainId
  function receiveFeedbackToVault(address _vault) external onlySelfOrVault {
    return IVault(_vault).receiveFunds();
  }

  /// @notice Step 6 push; Game pushes deltaAllocations to vaults
  /// @notice Push protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function pushProtocolAllocationsToVault(
    uint32 _chainId,
    address _vault,
    int256[] memory _deltas
  ) external payable onlyGame {
    if (_chainId == homeChain) return IVault(_vault).receiveProtocolAllocations(_deltas);
    else {
      bytes4 selector = bytes4(keccak256("receiveProtocolAllocationsToVault(address,int256[])"));
      bytes memory callData = abi.encodeWithSelector(selector, _vault, _deltas);

      xSend(_chainId, callData, 0);
    }
  }

  /// @notice Step 6 receive; Game pushes deltaAllocations to vaults
  /// @notice Receives protocol allocation array from the game to all vaults/chains
  /// @param _vault Address of the vault on given chainId
  /// @param _deltas Array with delta allocations where the index matches the protocolId
  function receiveProtocolAllocationsToVault(
    address _vault,
    int256[] memory _deltas
  ) external onlySelf {
    return IVault(_vault).receiveProtocolAllocations(_deltas);
  }

  /// @notice Step 8 push; Vaults push rewardsPerLockedToken to game
  /// @notice Push price and rewards array from vaults to the game
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function pushRewardsToGame(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external payable onlyVaults {
    if (_chainId == gameChain) {
      return IGame(game).settleRewards(_vaultNumber, _chainId, _rewards);
    } else {
      bytes4 selector = bytes4(keccak256("receiveRewardsToGame(uint256,uint32,int256[])"));
      bytes memory callData = abi.encodeWithSelector(selector, _vaultNumber, _chainId, _rewards);

      xSend(gameChain, callData, 0);
    }
  }

  /// @notice Step 8 receive; Vaults push rewardsPerLockedToken to game
  /// @notice Receives price and rewards array from vaults to the game
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function receiveRewardsToGame(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlySelf {
    return IGame(game).settleRewards(_vaultNumber, _chainId, _rewards);
  }

  /// @notice Push feedback to the vault if the vault is set to on or off
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _chainId Number of chain used
  /// @param _state bool for chainId on or off
  function pushStateFeedbackToVault(
    address _vault,
    uint32 _chainId,
    bool _state
  ) external payable onlyController {
    if (_chainId == homeChain) {
      return IVault(_vault).toggleVaultOnOff(_state);
    } else {
      bytes4 selector = bytes4(keccak256("receiveStateFeedbackToVault(address,bool)"));
      bytes memory callData = abi.encodeWithSelector(selector, _vault, _state);

      xSend(_chainId, callData, 0);
    }
  }

  /// @notice Receive feedback for the vault if the vault is set to on or off
  /// @param _vault Address of the Derby Vault on given chainId
  /// @param _state bool for chainId on or off
  function receiveStateFeedbackToVault(address _vault, bool _state) external onlySelf {
    return IVault(_vault).toggleVaultOnOff(_state);
  }

  /// @notice returns number of decimals for the vault
  function getDecimals(address _vault) external view returns (uint256) {
    return IVault(_vault).decimals();
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /*
  Only Dao functions
  */
  /// @notice set trusted provider on remote chains, allow owner to set it multiple times.
  /// @param _srcChainId Chain is for remote xprovider, some as the remote receiving contract chain id (xReceive)
  /// @param _srcAddress Address of remote xprovider
  function setTrustedRemoteConnext(uint32 _srcChainId, address _srcAddress) external onlyDao {
    trustedRemoteConnext[_srcChainId] = _srcAddress;
    emit SetTrustedRemoteConnext(_srcChainId, _srcAddress);
  }

  /// @notice Setter for xControlleraddress
  /// @param _xController New address of _xController
  function setXController(address _xController) external onlyDao {
    xController = _xController;
  }

  /// @notice Setter for xControllerProvider address
  /// @param _xControllerProvider New address of xProvider for xController chain
  function setXControllerProvider(address _xControllerProvider) external onlyDao {
    xControllerProvider = _xControllerProvider;
  }

  /// @notice Setter for xController chain id
  /// @param _xControllerChain new xController chainId
  function setXControllerChainId(uint32 _xControllerChain) external onlyDao {
    xControllerChain = _xControllerChain;
  }

  /// @notice Setter for homeChain Id
  /// @param _homeChain New home chainId
  function setHomeChain(uint32 _homeChain) external onlyDao {
    homeChain = _homeChain;
  }

  /// @notice Setter for gameChain Id
  /// @param _gameChain New chainId for game contract
  function setGameChainId(uint32 _gameChain) external onlyDao {
    gameChain = _gameChain;
  }

  /// @notice Whitelists vault address for onlyVault modifier
  function toggleVaultWhitelist(address _vault) external onlyDao {
    vaultWhitelist[_vault] = !vaultWhitelist[_vault];
  }

  /// @notice Setter for dao address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /// @notice Setter for new game address
  /// @param _game New address of the game
  function setGame(address _game) external onlyDao {
    game = _game;
  }

  /// @notice Setter for vault address to vaultNumber for guardian
  function setVaultAddress(uint256 _vaultNumber, address _vault) external onlyDao {
    vaults[_vaultNumber] = _vault;
  }

  /*
  Only Guardian functions
  */

  /// @notice Guardian function to send funds back to xController when xCall fails
  function sendFundsToXController(address _token) external onlyGuardian {
    require(xControllerChain == homeChain, "No xController on this chain");
    require(xController != address(0), "Zero address");

    uint256 balance = IERC20(_token).balanceOf(address(this));
    IERC20(_token).transfer(xController, balance);
  }

  /// @notice Guardian function to send funds back to vault when xCall fails
  function sendFundsToVault(uint256 _vaultNumber, address _token) external onlyGuardian {
    address vault = vaults[_vaultNumber];
    require(vault != address(0), "Zero address");

    uint256 balance = IERC20(_token).balanceOf(address(this));
    IERC20(_token).transfer(vault, balance);
  }
}
