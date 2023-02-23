// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Interfaces/IXProvider.sol";

contract XChainController {
  using SafeERC20 for IERC20;

  struct vaultInfo {
    int256 totalCurrentAllocation;
    uint256 totalUnderlying;
    uint256 totalSupply;
    uint256 totalWithdrawalRequests;
    // (chainId => bool): true == off // false == on
    mapping(uint32 => bool) chainIdOff;
    // (chainId => currentAllocation)
    mapping(uint32 => int256) currentAllocationPerChain;
    // (chainId => totalUnderlying)
    mapping(uint32 => uint256) totalUnderlyingPerChain;
    // (chainId => vaultAddress)
    mapping(uint32 => address) vaultChainAddress;
    // (chainId => underlyingAddress): e.g USDC
    mapping(uint32 => address) vaultUnderlyingAddress;
    // (chainId => totalWithdrawalRequests): total withdrawal requests in LP Token
    mapping(uint32 => uint256) withdrawalRequests;
    // (chainId => amountToDeposit)
    mapping(uint32 => uint256) amountToDepositPerChain;
  }

  // activeVaults; number of active vaults for vaultNumber, set in XChainRebalance
  // stage 0 Ready; waiting for game to send allocations
  // stage 1 AllocationsReceived; allocations received from game, ready to rebalance XChain and set activeVaults
  // stage 2 UnderlyingReceived; underlyings received from all active vault contracts
  // stage 3 FundsReceived; funds received from all active vault contracts
  struct vaultStages {
    uint256 activeVaults;
    bool ready; // stage 0
    bool allocationsReceived; // stage 1
    uint256 underlyingReceived; // stage 2
    uint256 fundsReceived; // stage 3
    uint256 fundsSent; // stage 4
  }

  address private dao;
  address private guardian;
  address public game;
  address public xProviderAddr;
  IXProvider public xProvider;

  uint32[] public chainIds;
  uint32 public homeChain;
  int256 public minimumAmount;

  // (vaultNumber => vaultInfo struct)
  mapping(uint256 => vaultInfo) internal vaults;
  // (vaultNumber => vaultStages struct)
  mapping(uint256 => vaultStages) public vaultStage;

  event SendXChainAmount(
    address _vault,
    uint32 _chainId,
    uint256 _amountToSendXChain,
    uint256 _exchangeRate,
    bool _receivingFunds
  );

  event SentFundsToVault(address _vault, uint32 _chainId, uint256 _amount, address _asset);

  modifier onlyGame() {
    require(msg.sender == game, "xController: only Game");
    _;
  }

  modifier onlyDao() {
    require(msg.sender == dao, "xController: only DAO");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "xController: only Guardian");
    _;
  }

  modifier onlyXProvider() {
    require(msg.sender == address(xProvider), "xController: only xProviderAddr");
    _;
  }

  // vaultStage 0
  modifier onlyWhenReady(uint256 _vaultNumber) {
    require(vaultStage[_vaultNumber].ready, "Not all vaults are ready");
    _;
  }

  // vaultStage 1
  modifier onlyWhenAllocationsReceived(uint256 _vaultNumber) {
    require(vaultStage[_vaultNumber].allocationsReceived, "Allocations not received from game");
    _;
  }

  // vaultStage 2
  modifier onlyWhenUnderlyingsReceived(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].underlyingReceived == vaultStage[_vaultNumber].activeVaults,
      "Not all underlyings received"
    );
    _;
  }

  // vaultStage 3
  modifier onlyWhenFundsReceived(uint256 _vaultNumber) {
    require(
      vaultStage[_vaultNumber].fundsReceived == vaultStage[_vaultNumber].activeVaults,
      "Not all funds received"
    );
    _;
  }

  constructor(address _game, address _dao, address _guardian, uint32 _homeChain) {
    game = _game;
    dao = _dao;
    guardian = _guardian;
    homeChain = _homeChain;
    minimumAmount = 1000e6;
  }

  /// @notice Setter for number of active vaults for vaultNumber, set in xChainRebalance
  /// @param _vaultNumber Number of the vault
  /// @param _activeVaults Number active vaults, calculated in xChainRebalance
  function setActiveVaults(uint256 _vaultNumber, uint256 _activeVaults) internal {
    vaultStage[_vaultNumber].activeVaults = _activeVaults;
  }

  /// @notice Setter for stage 0:
  /// @notice Ready; waiting for game to send allocations
  function setReady(uint256 _vaultNumber, bool _state) internal {
    vaultStage[_vaultNumber].ready = _state;
  }

  /// @notice Setter for stage 1:
  /// @notice AllocationsReceived; allocations received from game, ready to rebalance XChain and set activeVaults
  function setAllocationsReceived(
    uint256 _vaultNumber,
    bool _state
  ) internal onlyWhenReady(_vaultNumber) {
    vaultStage[_vaultNumber].allocationsReceived = _state;
  }

  /// @notice Setter to tick up stage 2:
  /// @notice UnderlyingReceived; underlyings received from all active vault contracts
  function upUnderlyingReceived(
    uint256 _vaultNumber
  ) internal onlyWhenAllocationsReceived(_vaultNumber) {
    vaultStage[_vaultNumber].underlyingReceived++;
  }

  /// @notice Step 4 end; Push funds from vaults to xChainController
  /// @notice FundsReceived; funds received from all active vault contracts
  function upFundsReceived(
    uint256 _vaultNumber
  ) external onlyXProvider onlyWhenUnderlyingsReceived(_vaultNumber) {
    vaultStage[_vaultNumber].fundsReceived++;
  }

  /// @notice Resets all stages in vaultStage struct for a vaultNumber
  function resetVaultStages(uint256 _vaultNumber) internal {
    vaultStage[_vaultNumber].ready = true;
    vaultStage[_vaultNumber].allocationsReceived = false;
    vaultStage[_vaultNumber].underlyingReceived = 0;
    vaultStage[_vaultNumber].fundsReceived = 0;
    vaultStage[_vaultNumber].fundsSent = 0;
  }

  /// @notice Resets underlying for a vaultNumber at the start of a rebalancing period
  function resetVaultUnderlying(uint256 _vaultNumber) internal {
    vaults[_vaultNumber].totalUnderlying = 0;
    vaultStage[_vaultNumber].underlyingReceived = 0;
    vaults[_vaultNumber].totalSupply = 0;
  }

  /// @notice Resets underlying for a vaultNumber per chainId at the start of a rebalancing period
  function resetVaultUnderlyingForChain(uint256 _vaultNumber, uint32 _chainId) internal {
    vaults[_vaultNumber].totalUnderlyingPerChain[_chainId] = 0;
  }

  /// @notice Step 1 end; Game pushes totalDeltaAllocations to xChainController
  /// @param _vaultNumber Number of Vault
  /// @param _deltas Delta allocations array received from game, indexes match chainIds[] set in this contract
  function receiveAllocationsFromGame(
    uint256 _vaultNumber,
    int256[] memory _deltas
  ) external onlyXProvider onlyWhenReady(_vaultNumber) {
    return receiveAllocationsFromGameInt(_vaultNumber, _deltas);
  }

  /// @notice Step 1 end; Game pushes totalDeltaAllocations to xChainController
  /// @param _vaultNumber Number of Vault
  /// @param _deltas Delta allocations array received from game, indexes match chainIds[] set in this contract
  function receiveAllocationsFromGameInt(uint256 _vaultNumber, int256[] memory _deltas) internal {
    uint256 activeVaults;

    for (uint256 i = 0; i < chainIds.length; i++) {
      uint32 chain = chainIds[i];
      activeVaults += settleCurrentAllocation(_vaultNumber, chain, _deltas[i]);
      resetVaultUnderlyingForChain(_vaultNumber, chain);
    }

    resetVaultUnderlying(_vaultNumber);
    setActiveVaults(_vaultNumber, activeVaults);
    setAllocationsReceived(_vaultNumber, true);
    setReady(_vaultNumber, false);
  }

  /// @notice Helper to settle the total current allocation with the delta allocations received from Game
  /// @notice Will set a chainId on/off depending on the currentAllocation and incoming deltaAllocation
  /// @dev if currentAllocation = 0 and deltaAllocation = 0, chainId will be set to Off and feedback will be send to vault
  /// @param _vaultNumber Number of Vault
  /// @param _chainId Number of chain used
  /// @param _deltas Delta allocations array received from game, indexes match chainIds[] set in this contract
  function settleCurrentAllocation(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256 _deltas
  ) internal returns (uint256 activeVault) {
    if (getCurrentAllocation(_vaultNumber, _chainId) == 0 && _deltas == 0) {
      vaults[_vaultNumber].chainIdOff[_chainId] = true;
      activeVault = 0;
    } else {
      vaults[_vaultNumber].chainIdOff[_chainId] = false;
      activeVault = 1;
    }

    vaults[_vaultNumber].totalCurrentAllocation += _deltas;
    vaults[_vaultNumber].currentAllocationPerChain[_chainId] += _deltas;

    require(vaults[_vaultNumber].totalCurrentAllocation >= 0, "Allocation underflow");
  }

  /// @notice Will send feedback to the vault if it is turned on or off by settleCurrentAllocation
  /// @notice Step 1.5, toggle vault on or off
  /// @param _vaultNumber Number of vault
  /// @param _chainId Chain id of the vault where the funds need to be sent
  function sendFeedbackToVault(uint256 _vaultNumber, uint32 _chainId) external payable {
    address vault = getVaultAddress(_vaultNumber, _chainId);
    require(vault != address(0), "xChainController: not a valid vaultnumber");
    xProvider.pushStateFeedbackToVault{value: msg.value}(
      vault,
      _chainId,
      vaults[_vaultNumber].chainIdOff[_chainId]
    );
  }

  /// @notice See setTotalUnderlyingInt below
  function setTotalUnderlying(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external onlyXProvider onlyWhenAllocationsReceived(_vaultNumber) {
    require(getTotalUnderlyingOnChain(_vaultNumber, _chainId) == 0, "TotalUnderlying already set");
    setTotalUnderlyingInt(_vaultNumber, _chainId, _underlying, _totalSupply, _withdrawalRequests);
  }

  /// @notice Step 2 end; Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController
  /// @notice Receive and set totalUnderlyings from the vaults for every chainId
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _underlying totalUnderling plus vault balance in vaultcurrency e.g USDC
  /// @param _totalSupply Supply of the LP token of the vault on given chainId
  /// @param _withdrawalRequests Total amount of withdrawal requests from the vault in LP Tokens
  function setTotalUnderlyingInt(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) internal {
    vaults[_vaultNumber].totalUnderlyingPerChain[_chainId] = _underlying;
    vaults[_vaultNumber].withdrawalRequests[_chainId] = _withdrawalRequests;
    vaults[_vaultNumber].totalSupply += _totalSupply;
    vaults[_vaultNumber].totalUnderlying += _underlying;
    vaults[_vaultNumber].totalWithdrawalRequests += _withdrawalRequests;
    vaultStage[_vaultNumber].underlyingReceived++;
  }

  /// @notice Step 3 trigger; xChainController pushes exchangeRate and amount the vaults have to send back to all vaults
  /// @notice Calculates the amounts the vaults on each chainId have to send or receive
  /// @param _vaultNumber Number of vault
  /// @param _chain Chain id of the vault where the funds need to be sent
  function pushVaultAmounts(
    uint256 _vaultNumber,
    uint16 _chain
  ) external payable onlyWhenUnderlyingsReceived(_vaultNumber) {
    address vault = getVaultAddress(_vaultNumber, _chain);
    require(vault != address(0), "xChainController: not a valid vaultnumber");
    int256 totalAllocation = getCurrentTotalAllocation(_vaultNumber);
    uint256 totalWithdrawalRequests = getTotalWithdrawalRequests(_vaultNumber);
    uint256 totalUnderlying = getTotalUnderlyingVault(_vaultNumber) - totalWithdrawalRequests;
    uint256 totalSupply = getTotalSupply(_vaultNumber);

    uint256 decimals = xProvider.getDecimals(vault);
    uint256 newExchangeRate = (totalUnderlying * (10 ** decimals)) / totalSupply;

    if (!getVaultChainIdOff(_vaultNumber, _chain)) {
      int256 amountToChain = calcAmountToChain(
        _vaultNumber,
        _chain,
        totalUnderlying,
        totalAllocation
      );
      (int256 amountToDeposit, uint256 amountToWithdraw) = calcDepositWithdraw(
        _vaultNumber,
        _chain,
        amountToChain
      );

      sendXChainAmount(_vaultNumber, _chain, amountToDeposit, amountToWithdraw, newExchangeRate);
    }
  }

  /// @notice Calculates the amounts the vaults on each chainId have to send or receive
  /// @param _vaultNumber number of the vault
  /// @param _chainId Number of chain used
  /// @param _amountToChain Amount in vaultcurrency that should be on given chainId
  function calcDepositWithdraw(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256 _amountToChain
  ) internal view returns (int256, uint256) {
    uint256 currentUnderlying = getTotalUnderlyingOnChain(_vaultNumber, _chainId);

    int256 amountToDeposit = _amountToChain - int256(currentUnderlying);
    uint256 amountToWithdraw = amountToDeposit < 0
      ? currentUnderlying - uint256(_amountToChain)
      : 0;

    return (amountToDeposit, amountToWithdraw);
  }

  /// @notice Calculates the amounts the vaults has to send back to the xChainController
  /// @param _totalUnderlying Total underlying on all chains for given vaultNumber
  /// @param _totalAllocation Total allocation on all chains for given vaultNumber
  function calcAmountToChain(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _totalUnderlying,
    int256 _totalAllocation
  ) internal view returns (int256) {
    int256 allocation = getCurrentAllocation(_vaultNumber, _chainId);
    uint256 withdrawalRequests = getWithdrawalRequests(_vaultNumber, _chainId);

    int256 amountToChain = (int(_totalUnderlying) * allocation) / _totalAllocation;
    amountToChain += int(withdrawalRequests);

    return amountToChain;
  }

  /// @notice Sends out cross-chain messages to vaults with the amount the vault has to send back
  /// @dev if the xChainController needs to deposit, the amount will be 0 so the vault knows it will receive currency
  /// @param _amountDeposit Amount the vault will receive from the xChainController
  /// @param _amountToWithdraw Amount the vault will have to send back to the xChainController
  /// @param _exchangeRate New exchangerate for vaults
  function sendXChainAmount(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256 _amountDeposit,
    uint256 _amountToWithdraw,
    uint256 _exchangeRate
  ) internal {
    address vault = getVaultAddress(_vaultNumber, _chainId);
    bool receivingFunds;
    uint256 amountToSend = 0;

    if (_amountDeposit > 0 && _amountDeposit < minimumAmount) {
      vaultStage[_vaultNumber].fundsReceived++;
    } else if (_amountDeposit >= minimumAmount) {
      receivingFunds = true;
      setAmountToDeposit(_vaultNumber, _chainId, _amountDeposit);
      vaultStage[_vaultNumber].fundsReceived++;
    }

    if (_amountToWithdraw > 0 && _amountToWithdraw < uint(minimumAmount)) {
      vaultStage[_vaultNumber].fundsReceived++;
    } else if (_amountToWithdraw >= uint(minimumAmount)) {
      amountToSend = _amountToWithdraw;
    }

    xProvider.pushSetXChainAllocation{value: msg.value}(
      vault,
      _chainId,
      amountToSend,
      _exchangeRate,
      receivingFunds
    );
    emit SendXChainAmount(vault, _chainId, amountToSend, _exchangeRate, receivingFunds);
  }

  /// @notice Step 5 trigger; Push funds from xChainController to vaults
  /// @notice Send amount to deposit from xController to vault and reset all stages for the vault
  /// @param _vaultNumber Number of vault
  /// @param _slippage Slippage tollerance for xChain swap, in BPS (i.e. 30 = 0.3%)
  /// @param _chain Chain id of the vault where the funds need to be sent
  /// @param _relayerFee The fee offered to the relayers
  function sendFundsToVault(
    uint256 _vaultNumber,
    uint256 _slippage,
    uint32 _chain,
    uint256 _relayerFee
  ) external payable onlyWhenFundsReceived(_vaultNumber) {
    address vault = getVaultAddress(_vaultNumber, _chain);
    require(vault != address(0), "xChainController: not a valid vaultnumber");
    if (!getVaultChainIdOff(_vaultNumber, _chain)) {
      uint256 amountToDeposit = getAmountToDeposit(_vaultNumber, _chain);

      if (amountToDeposit > 0) {
        address underlying = getUnderlyingAddress(_vaultNumber, _chain);

        uint256 balance = IERC20(underlying).balanceOf(address(this));
        if (amountToDeposit > balance) amountToDeposit = balance;

        IERC20(underlying).safeIncreaseAllowance(address(xProvider), amountToDeposit);
        xProvider.xTransferToVaults{value: msg.value}(
          vault,
          _chain,
          amountToDeposit,
          underlying,
          _slippage,
          _relayerFee
        );
        setAmountToDeposit(_vaultNumber, _chain, 0);
        emit SentFundsToVault(vault, _chain, amountToDeposit, underlying);
      }
    }
    vaultStage[_vaultNumber].fundsSent++;
    if (vaultStage[_vaultNumber].fundsSent == chainIds.length) resetVaultStages(_vaultNumber);
  }

  /// @notice Helper to get total current allocation of vaultNumber
  function getTotalUnderlyingOnChain(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal view returns (uint256) {
    return vaults[_vaultNumber].totalUnderlyingPerChain[_chainId];
  }

  /// @notice Gets saved totalUnderlying for vaultNumber
  function getTotalUnderlyingVault(
    uint256 _vaultNumber
  ) internal view onlyWhenUnderlyingsReceived(_vaultNumber) returns (uint256) {
    return vaults[_vaultNumber].totalUnderlying;
  }

  /// @notice Helper to get vault address of vaultNumber with given chainID
  function getVaultAddress(uint256 _vaultNumber, uint32 _chainId) internal view returns (address) {
    return vaults[_vaultNumber].vaultChainAddress[_chainId];
  }

  /// @notice Helper to get underyling address of vaultNumber with given chainID eg USDC
  function getUnderlyingAddress(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal view returns (address) {
    return vaults[_vaultNumber].vaultUnderlyingAddress[_chainId];
  }

  /// @notice Helper to get current allocation per chain of vaultNumber with given chainID
  function getCurrentAllocation(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal view returns (int256) {
    return vaults[_vaultNumber].currentAllocationPerChain[_chainId];
  }

  /// @notice Helper to get total current allocation of vaultNumber
  function getCurrentTotalAllocation(uint256 _vaultNumber) internal view returns (int256) {
    return vaults[_vaultNumber].totalCurrentAllocation;
  }

  /// @notice Helper to get if vault is active or not
  function getVaultChainIdOff(uint256 _vaultNumber, uint32 _chainId) public view returns (bool) {
    return vaults[_vaultNumber].chainIdOff[_chainId];
  }

  /// @notice Helper to set the amount to deposit in a chain vault
  function setAmountToDeposit(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256 _amountToDeposit
  ) internal {
    vaults[_vaultNumber].amountToDepositPerChain[_chainId] = uint256(_amountToDeposit);
  }

  /// @notice Helper to get the amount to deposit in a chain vault
  function getAmountToDeposit(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal view returns (uint256) {
    return vaults[_vaultNumber].amountToDepositPerChain[_chainId];
  }

  /// @notice Helper to get total supply from the vault on given chainId
  function getTotalSupply(uint256 _vaultNumber) internal view returns (uint256) {
    return vaults[_vaultNumber].totalSupply;
  }

  /// @notice Helper to get withdrawal requests from the vault on given chainId
  function getWithdrawalRequests(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal view returns (uint256) {
    return vaults[_vaultNumber].withdrawalRequests[_chainId];
  }

  /// @notice Helper to get total withdrawal requests from the vault on given chainId
  function getTotalWithdrawalRequests(uint256 _vaultNumber) internal view returns (uint256) {
    return vaults[_vaultNumber].totalWithdrawalRequests;
  }

  /// @notice Getter for chainId array
  function getChainIds() public view returns (uint32[] memory) {
    return chainIds;
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Getter for guardian address
  function getGuardian() public view returns (address) {
    return guardian;
  }

  /*
  Only Dao functions
  */

  /// @notice Set Vault address and underlying for a particulair chainId
  /// @param _vaultNumber number of Vault
  /// @param _chainId Number of chain used
  /// @param _address address of the Vault
  /// @param _underlying underlying of the Vault eg USDC
  function setVaultChainAddress(
    uint256 _vaultNumber,
    uint32 _chainId,
    address _address,
    address _underlying
  ) external onlyDao {
    vaults[_vaultNumber].vaultChainAddress[_chainId] = _address;
    vaults[_vaultNumber].vaultUnderlyingAddress[_chainId] = _underlying;
  }

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setHomeXProvider(address _xProvider) external onlyDao {
    xProvider = IXProvider(_xProvider);
  }

  /// @notice Setter for homeChain Id
  /// @param _homeChainId New home chainId
  function setHomeChainId(uint32 _homeChainId) external onlyDao {
    homeChain = _homeChainId;
  }

  /// @notice Setter for DAO address
  /// @param _dao DAO address
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

  /// @notice Setter for minumum amount to send xchain
  /// @param _amount New minimum amount
  function setMinimumAmount(int256 _amount) external onlyDao {
    minimumAmount = _amount;
  }

  /*
  Only Guardian functions
  */

  /// @notice Setter for chainId array
  /// @param _chainIds array of all the used chainIds
  function setChainIds(uint32[] memory _chainIds) external onlyGuardian {
    chainIds = _chainIds;
  }

  /// @notice Resets all stages in vaultStage struct for a vaultNumber
  /// @notice Must be run when a new vaultNumber is deployed
  /// @dev onlyGuardian modifier so the dao can reset all stages for a vaultNumber incase something goes wrong
  function resetVaultStagesDao(uint256 _vaultNumber) external onlyGuardian {
    return resetVaultStages(_vaultNumber);
  }

  /// @notice Step 1: Guardian function
  function receiveAllocationsFromGameGuard(
    uint256 _vaultNumber,
    int256[] memory _deltas
  ) external onlyGuardian {
    return receiveAllocationsFromGameInt(_vaultNumber, _deltas);
  }

  /// @notice Step 2: Guardian function
  function setTotalUnderlyingGuard(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external onlyGuardian {
    return
      setTotalUnderlyingInt(_vaultNumber, _chainId, _underlying, _totalSupply, _withdrawalRequests);
  }

  /// @notice Step 4: Guardian function
  function setFundsReceivedGuard(
    uint256 _vaultNumber,
    uint256 _fundsReceived
  ) external onlyGuardian {
    vaultStage[_vaultNumber].fundsReceived = _fundsReceived;
  }

  /// @notice Guardian setter for number of active vaults for vaultNumber, set in xChainRebalance
  function setActiveVaultsGuard(uint256 _vaultNumber, uint256 _activeVaults) external onlyGuardian {
    vaultStage[_vaultNumber].activeVaults = _activeVaults;
  }

  /// @notice Guardian setter for stage 0:
  function setReadyGuard(uint256 _vaultNumber, bool _state) external onlyGuardian {
    vaultStage[_vaultNumber].ready = _state;
  }

  /// @notice Guardian setter for stage 1:
  function setAllocationsReceivedGuard(uint256 _vaultNumber, bool _state) external onlyGuardian {
    vaultStage[_vaultNumber].allocationsReceived = _state;
  }

  /// @notice Guardian setter to tick up stage 2:
  function setUnderlyingReceivedGuard(
    uint256 _vaultNumber,
    uint256 _underlyingReceived
  ) external onlyGuardian {
    vaultStage[_vaultNumber].underlyingReceived = _underlyingReceived;
  }
}
