// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./Interfaces/IController.sol";
import "./Interfaces/IProvider.sol";

import "./VaultToken.sol";
import "./libraries/Swap.sol";

contract Vault is ReentrancyGuard {
  using SafeERC20 for IERC20;

  // state 0 Rebalance done and ready for xController to rebalance again
  // state 1 Allocation amount received and ready to send funds over to xController
  // state 2 Allocation amount 0 received => will receive funds from xController
  // state 3 Allocation amount sent or received and ready to rebalance the vault itself
  enum State {
    Idle,
    PushedUnderlying,
    SendingFundsXChain,
    WaitingForFunds,
    RebalanceVault,
    SendRewardsPerToken
  }

  IERC20 internal vaultCurrency;
  IController internal controller;
  State public state;

  bool public deltaAllocationsReceived;

  address private dao;
  address private guardian;
  address public vaultCurrencyAddr;
  address public xController;

  uint256 public vaultNumber;
  uint256 public liquidityPerc;
  uint256 public performanceFee;
  uint256 public rebalancingPeriod;
  uint256 public uScale;
  uint256 public minimumPull;
  int256 public marginScale;

  // UNIX timestamp
  uint256 public rebalanceInterval;
  uint256 public lastTimeStamp;

  // total underlying of all protocols in vault, excluding vault balance
  uint256 public savedTotalUnderlying;

  // total amount of funds the vault reserved for users that made a withdrawalRequest
  uint256 internal reservedFunds;

  // total number of allocated Derby tokens currently
  int256 public totalAllocatedTokens;
  // delta of the total number of Derby tokens allocated on next rebalancing
  int256 private deltaAllocatedTokens;

  string internal stateError = "Wrong state";

  // (protocolNumber => currentAllocation): current allocations over the protocols
  mapping(uint256 => int256) internal currentAllocations;

  // (protocolNumber => deltaAllocation): delta of the portfolio on next rebalancing
  mapping(uint256 => int256) internal deltaAllocations;

  // historical reward per protocol per token, formula: TVL * yield * perfFee / totalLockedTokens
  // (rebalancingPeriod => protocolId => rewardPerLockedToken)
  mapping(uint256 => mapping(uint256 => int256)) public rewardPerLockedToken;

  // (protocolNumber => lastPrice): last price of underlying protocol vault
  mapping(uint256 => uint256) public lastPrices;

  modifier onlyDao() {
    require(msg.sender == dao, "Vault: only DAO");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "only Guardian");
    _;
  }

  constructor(
    uint256 _vaultNumber,
    address _dao,
    address _controller,
    address _vaultCurrency,
    uint256 _uScale
  ) {
    controller = IController(_controller);
    vaultCurrency = IERC20(_vaultCurrency);

    vaultNumber = _vaultNumber;
    dao = _dao;
    uScale = _uScale;
    lastTimeStamp = block.timestamp;
    minimumPull = 1_000_000;
  }

  /// @notice Withdraw from protocols on shortage in Vault
  /// @dev Keeps on withdrawing until the Vault balance > _value
  /// @param _value The total value of vaultCurrency an user is trying to withdraw.
  /// @param _value The (value - current underlying value of this vault) is withdrawn from the underlying protocols.
  function pullFunds(uint256 _value) internal {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;

      uint256 shortage = _value - vaultCurrency.balanceOf(address(this));
      uint256 balanceProtocol = balanceUnderlying(i);

      uint256 amountToWithdraw = shortage > balanceProtocol ? balanceProtocol : shortage;
      savedTotalUnderlying -= amountToWithdraw;

      if (amountToWithdraw < minimumPull) break;
      withdrawFromProtocol(i, amountToWithdraw);

      if (_value <= vaultCurrency.balanceOf(address(this))) break;
    }
  }

  /// @notice Step 7 trigger, end; Vaults rebalance
  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev amountToProtocol = totalAmount * currentAllocation / totalAllocatedTokens
  /// @dev amountToDeposit = amountToProtocol - currentBalanceProtocol
  /// @dev if amountToDeposit < 0 => withdraw
  /// @dev Execute all withdrawals before deposits
  function rebalance() external nonReentrant {
    require(state == State.RebalanceVault, stateError);
    require(deltaAllocationsReceived, "!Delta allocations");

    rebalancingPeriod++;

    claimTokens();
    settleDeltaAllocation();

    uint256 underlyingIncBalance = calcUnderlyingIncBalance();
    uint256[] memory protocolToDeposit = rebalanceCheckProtocols(underlyingIncBalance);

    executeDeposits(protocolToDeposit);
    setTotalUnderlying();

    if (reservedFunds > vaultCurrency.balanceOf(address(this))) pullFunds(reservedFunds);

    state = State.SendRewardsPerToken;
    deltaAllocationsReceived = false;
  }

  /// @notice Helper to return underlying balance plus totalUnderlying - liquidty for the vault
  /// @return underlying totalUnderlying - liquidityVault
  function calcUnderlyingIncBalance() internal view returns (uint256) {
    uint256 totalUnderlyingInclVaultBalance = savedTotalUnderlying +
      getVaultBalance() -
      reservedFunds;
    uint256 liquidityVault = (totalUnderlyingInclVaultBalance * liquidityPerc) / 100;
    return totalUnderlyingInclVaultBalance - liquidityVault;
  }

  /// @notice Adds deltaAllocatedTokens to totalAllocatedTokens
  function settleDeltaAllocation() internal {
    totalAllocatedTokens += deltaAllocatedTokens;
    deltaAllocatedTokens = 0;
  }

  /// @notice Rebalances i.e deposit or withdraw from all underlying protocols
  /// @dev Loops over all protocols in ETF, calculate new currentAllocation based on deltaAllocation
  /// @dev Also calculate the performance fee here. This is an amount, based on the current TVL (before the rebalance),
  /// @dev the performanceFee and difference between the current exchangeRate and the exchangeRate of the last rebalance of the vault.
  /// @param _newTotalUnderlying this will be the new total underlying: Totalunderlying = TotalUnderlyingInProtocols - BalanceVault
  /// @return uint256[] with amounts to deposit in protocols, the index being the protocol number.
  function rebalanceCheckProtocols(
    uint256 _newTotalUnderlying
  ) internal returns (uint256[] memory) {
    uint256[] memory protocolToDeposit = new uint[](controller.latestProtocolId(vaultNumber));
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      bool isBlacklisted = controller.getProtocolBlacklist(vaultNumber, i);

      storePriceAndRewards(_newTotalUnderlying, i);

      if (isBlacklisted) continue;
      setAllocation(i);

      int256 amountToProtocol = calcAmountToProtocol(_newTotalUnderlying, i);
      uint256 currentBalance = balanceUnderlying(i);

      int256 amountToDeposit = amountToProtocol - int(currentBalance);
      uint256 amountToWithdraw = amountToDeposit < 0 ? currentBalance - uint(amountToProtocol) : 0;

      if (amountToDeposit > marginScale) protocolToDeposit[i] = uint256(amountToDeposit);
      if (amountToWithdraw > uint(marginScale) || currentAllocations[i] == 0)
        withdrawFromProtocol(i, amountToWithdraw);
    }

    return protocolToDeposit;
  }

  /// @notice Calculates the amount to deposit or withdraw to protocol during a vault rebalance
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault
  /// @param _protocol Protocol id number
  /// @return amountToProtocol amount to deposit or withdraw to protocol
  function calcAmountToProtocol(
    uint256 _totalUnderlying,
    uint256 _protocol
  ) internal view returns (int256 amountToProtocol) {
    if (totalAllocatedTokens == 0) amountToProtocol = 0;
    else
      amountToProtocol =
        (int(_totalUnderlying) * currentAllocations[_protocol]) /
        totalAllocatedTokens;
  }

  /// @notice Stores the historical price and the reward per rounded locked token, ignoring decimals.
  /// @dev formula yield protocol i at time t: y(it) = (P(it) - P(it-1)) / P(it-1).
  /// @dev formula rewardPerLockedToken for protocol i at time t: r(it) = y(it) * TVL(t) * perfFee(t) / totalLockedTokens(t)
  /// @dev later, when the total rewards are calculated for a game player we multiply this (r(it)) by the locked tokens on protocol i at time t
  /// @param _totalUnderlying Totalunderlying = TotalUnderlyingInProtocols - BalanceVault.
  /// @param _protocolId Protocol id number.
  function storePriceAndRewards(uint256 _totalUnderlying, uint256 _protocolId) internal {
    uint256 currentPrice = price(_protocolId);
    if (lastPrices[_protocolId] == 0) {
      lastPrices[_protocolId] = currentPrice;
      return;
    }

    int256 priceDiff = int256(currentPrice - lastPrices[_protocolId]);
    int256 nominator = (int256(_totalUnderlying * performanceFee) * priceDiff);
    int256 totalAllocatedTokensRounded = totalAllocatedTokens / 1E18;
    int256 denominator = totalAllocatedTokensRounded * int256(lastPrices[_protocolId]) * 100; // * 100 cause perfFee is in percentages

    if (totalAllocatedTokensRounded == 0) {
      rewardPerLockedToken[rebalancingPeriod][_protocolId] = 0;
    } else {
      rewardPerLockedToken[rebalancingPeriod][_protocolId] = nominator / denominator;
    }

    lastPrices[_protocolId] = currentPrice;
  }

  /// @notice Creates array out of the rewardsPerLockedToken mapping to send to the game
  /// @return rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function rewardsToArray() internal view returns (int256[] memory rewards) {
    uint256 latestId = controller.latestProtocolId(vaultNumber);

    rewards = new int[](latestId);
    for (uint256 i = 0; i < latestId; i++) {
      rewards[i] = rewardPerLockedToken[rebalancingPeriod][i];
    }
  }

  /// @notice Helper function to set allocations
  /// @param _i Protocol number linked to an underlying protocol e.g compound_usdc_01
  function setAllocation(uint256 _i) internal {
    currentAllocations[_i] += deltaAllocations[_i];
    deltaAllocations[_i] = 0;
    require(currentAllocations[_i] >= 0, "Allocation underflow");
  }

  /// @notice Helper function so the rebalance will execute all withdrawals first
  /// @dev Executes and resets all deposits set in mapping(protocolToDeposit) by rebalanceETF
  /// @param protocolToDeposit array with amounts to deposit in protocols, the index being the protocol number.
  function executeDeposits(uint256[] memory protocolToDeposit) internal {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      uint256 amount = protocolToDeposit[i];
      if (amount == 0) continue;
      depositInProtocol(i, amount);
    }
  }

  /// @notice Deposit amount to underlying protocol
  /// @dev Deposits VaultCurrency in Protocol e.g USDC
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to deposit
  function depositInProtocol(uint256 _protocolNum, uint256 _amount) internal {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );

    if (getVaultBalance() < _amount) _amount = getVaultBalance();

    if (protocol.underlying != address(vaultCurrency)) {
      _amount = Swap.swapStableCoins(
        Swap.SwapInOut(_amount, address(vaultCurrency), protocol.underlying),
        uScale,
        controller.underlyingUScale(protocol.underlying),
        controller.getCurveParams(address(vaultCurrency), protocol.underlying)
      );
    }

    IERC20(protocol.underlying).safeIncreaseAllowance(protocol.provider, _amount);
    IProvider(protocol.provider).deposit(_amount, protocol.LPToken, protocol.underlying);
  }

  /// @notice Withdraw amount from underlying protocol
  /// @dev shares = amount / PricePerShare
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount in VaultCurrency to withdraw
  function withdrawFromProtocol(uint256 _protocolNum, uint256 _amount) internal {
    if (_amount <= 0) return;
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );

    _amount = (_amount * protocol.uScale) / uScale;
    uint256 shares = IProvider(protocol.provider).calcShares(_amount, protocol.LPToken);
    uint256 balance = IProvider(protocol.provider).balance(address(this), protocol.LPToken);

    if (shares == 0) return;
    if (balance < shares) shares = balance;

    IERC20(protocol.LPToken).safeIncreaseAllowance(protocol.provider, shares);
    uint256 amountReceived = IProvider(protocol.provider).withdraw(
      shares,
      protocol.LPToken,
      protocol.underlying
    );

    if (protocol.underlying != address(vaultCurrency)) {
      _amount = Swap.swapStableCoins(
        Swap.SwapInOut(amountReceived, protocol.underlying, address(vaultCurrency)),
        controller.underlyingUScale(protocol.underlying),
        uScale,
        controller.getCurveParams(protocol.underlying, address(vaultCurrency))
      );
    }
  }

  /// @notice Set total balance in VaultCurrency in all underlying protocols
  function setTotalUnderlying() public {
    uint totalUnderlying;
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;
      totalUnderlying += balanceUnderlying(i);
    }
    savedTotalUnderlying = totalUnderlying;
  }

  /// @notice Get balance in VaultCurrency in underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return Balance in VaultCurrency e.g USDC
  function balanceUnderlying(uint256 _protocolNum) public view returns (uint256) {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    uint256 underlyingBalance = (IProvider(protocol.provider).balanceUnderlying(
      address(this),
      protocol.LPToken
    ) * uScale) / protocol.uScale;
    return underlyingBalance;
  }

  /// @notice Calculates how many shares are equal to the amount in vault currency
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @param _amount Amount in underyling token e.g USDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _protocolNum, uint256 _amount) public view returns (uint256) {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    uint256 shares = IProvider(protocol.provider).calcShares(
      (_amount * protocol.uScale) / uScale,
      protocol.LPToken
    );

    return shares;
  }

  /// @notice Get price for underlying protocol
  /// @param _protocolNum Protocol number linked to an underlying protocol e.g compound_usdc_01
  /// @return protocolPrice Price per lp token
  function price(uint256 _protocolNum) public view returns (uint256) {
    IController.ProtocolInfoS memory protocol = controller.getProtocolInfo(
      vaultNumber,
      _protocolNum
    );
    return IProvider(protocol.provider).exchangeRate(protocol.LPToken);
  }

  /// @notice Set the delta allocated tokens by game contract
  /// @dev Allocation can be negative
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _allocation Delta allocation in tokens
  function setDeltaAllocationsInt(uint256 _protocolNum, int256 _allocation) internal {
    require(!controller.getProtocolBlacklist(vaultNumber, _protocolNum), "Protocol on blacklist");
    deltaAllocations[_protocolNum] += _allocation;
    deltaAllocatedTokens += _allocation;
  }

  /// @notice Harvest extra tokens from underlying protocols
  /// @dev Loops over protocols in ETF and check if they are claimable in controller contract
  function claimTokens() public {
    uint256 latestID = controller.latestProtocolId(vaultNumber);
    for (uint i = 0; i < latestID; i++) {
      if (currentAllocations[i] == 0) continue;
      bool claim = controller.claim(vaultNumber, i);
      if (claim) {
        address govToken = controller.getGovToken(vaultNumber, i);
        uint256 tokenBalance = IERC20(govToken).balanceOf(address(this));
        Swap.swapTokensMulti(
          Swap.SwapInOut(tokenBalance, govToken, address(vaultCurrency)),
          controller.getUniswapParams(),
          false
        );
      }
    }
  }

  function getVaultBalance() public view returns (uint256) {
    return vaultCurrency.balanceOf(address(this));
  }

  /// @notice Checks if a rebalance is needed based on the set interval
  /// @return bool True of rebalance is needed, false if not
  function rebalanceNeeded() public view returns (bool) {
    return (block.timestamp - lastTimeStamp) > rebalanceInterval || msg.sender == guardian;
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

  /// @notice Set the performanceFee, the percentage of the yield that goes to the game players.
  /// @dev The actual performanceFee could be a bit more or a bit less than the performanceFee set here due to approximations in the game.
  /// @param _performanceFee Value at which to set the performanceFee.
  function setPerformanceFee(uint256 _performanceFee) external onlyDao {
    require(_performanceFee <= 100);
    performanceFee = _performanceFee;
  }

  /// @notice Set the governance address
  /// @param _dao New address of the governance / DAO
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /*
  Only Guardian functions
  */

  /// @notice Set minimum interval for the rebalance function
  /// @param _timestampInternal UNIX timestamp
  function setRebalanceInterval(uint256 _timestampInternal) external onlyGuardian {
    rebalanceInterval = _timestampInternal;
  }

  /// @notice The DAO should be able to blacklist protocols, the funds should be sent to the vault.
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  function blacklistProtocol(uint256 _protocolNum) external onlyGuardian {
    uint256 balanceProtocol = balanceUnderlying(_protocolNum);
    currentAllocations[_protocolNum] = 0;
    controller.setProtocolBlacklist(vaultNumber, _protocolNum);
    savedTotalUnderlying -= balanceProtocol;
    withdrawFromProtocol(_protocolNum, balanceProtocol);
  }

  /// @notice Set the marginScale, the threshold used for deposits and withdrawals.
  /// @notice If the threshold is not met the deposit/ withdrawal is not executed.
  /// @dev Take into account the uScale (scale of the underlying).
  /// @param _marginScale Value at which to set the marginScale.
  function setMarginScale(int256 _marginScale) external onlyGuardian {
    marginScale = _marginScale;
  }

  /// @notice Set the liquidityPerc, the amount of liquidity which should be held in the vault after rebalancing.
  /// @dev The actual liquidityPerc could be a bit more or a bit less than the liquidityPerc set here.
  /// @dev This is because some deposits or withdrawals might not execute because they don't meet the marginScale.
  /// @param _liquidityPerc Value at which to set the liquidityPerc.
  function setLiquidityPerc(uint256 _liquidityPerc) external onlyGuardian {
    require(_liquidityPerc <= 100);
    liquidityPerc = _liquidityPerc;
  }

  /// @notice callback to receive Ether from unwrapping WETH
  receive() external payable {
    require(msg.sender == Swap.WETH, "Not WETH");
  }
}
