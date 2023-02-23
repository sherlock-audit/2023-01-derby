// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../MainVault.sol";

contract MainVaultMock is MainVault {
  mapping(uint256 => uint256) private players;

  event MinAmountOut(uint256 minAmountOut);

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _vaultNumber,
    address _dao,
    address _Game,
    address _controller,
    address _vaultCurrency,
    uint256 _uScale
  )
    MainVault(
      _name,
      _symbol,
      _decimals,
      _vaultNumber,
      _dao,
      _Game,
      _controller,
      _vaultCurrency,
      _uScale
    )
  {}

  function getAllocationTEST(uint256 _protocolNum) external view returns (int256) {
    return currentAllocations[_protocolNum];
  }

  function getDeltaAllocationTEST(uint256 _protocolNum) external view returns (int256) {
    return deltaAllocations[_protocolNum];
  }

  function setDeltaAllocations(uint256 _protocolNum, int256 _allocation) external {
    return setDeltaAllocationsInt(_protocolNum, _allocation);
  }

  function setDeltaAllocationsReceivedTEST(bool _state) external {
    deltaAllocationsReceived = _state;
  }

  function setTotalAllocatedTokensTest(int256 _tokens) external {
    totalAllocatedTokens = _tokens;
  }

  function setAmountToSendXChainTEST(uint256 _amount) external {
    amountToSendXChain = _amount;
  }

  function getLastPriceTEST(uint256 _protocolId) external view returns (uint256) {
    return lastPrices[_protocolId];
  }

  function getWithdrawalAllowanceTEST(address _address) external view returns (uint256) {
    return userInfo[_address].withdrawalAllowance;
  }

  function getRewardAllowanceTEST(address _address) external view returns (uint256) {
    return userInfo[_address].rewardAllowance;
  }

  function getTotalWithdrawalRequestsTEST() external view returns (uint256) {
    return totalWithdrawalRequests;
  }

  function getReservedFundsTEST() external view returns (uint256) {
    return reservedFunds;
  }

  function setExchangeRateTEST(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }

  function setReservedFundsTEST(uint256 _amount) external {
    reservedFunds = _amount;
  }

  function upRebalancingPeriodTEST() external {
    rebalancingPeriod++;
  }

  function setCurrentAllocation(uint256 _protocolNum, int256 _allocation) external {
    currentAllocations[_protocolNum] = _allocation;
  }

  function resetDeltaAllocations(uint256 _protocolNum) external {
    deltaAllocations[_protocolNum] = 0;
  }

  function clearCurrencyBalance(uint256 _balance) external {
    vaultCurrency.transfer(getDao(), _balance);
  }

  function toggleVaultOnOffTEST(bool _state) external {
    vaultOff = _state;
  }

  function balanceSharesTEST(
    uint256 _protocolNum,
    address _address
  ) external view returns (uint256) {
    IController.ProtocolInfoS memory p = controller.getProtocolInfo(vaultNumber, _protocolNum);
    uint256 balance = IProvider(p.provider).balance(_address, p.LPToken);

    return balance;
  }

  function swapTokensMultiTest(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut,
    bool _rewardsSwap
  ) external returns (uint256) {
    return
      Swap.swapTokensMulti(
        Swap.SwapInOut(_amount, _tokenIn, _tokenOut),
        controller.getUniswapParams(),
        _rewardsSwap
      );
  }

  function swapMinAmountOutMultiTest(
    uint256 _amount,
    address _tokenIn,
    address _tokenOut
  ) external {
    uint256 minAmountOut = Swap.amountOutMultiSwap(
      Swap.SwapInOut(_amount, _tokenIn, _tokenOut),
      controller.getUniswapQuoter(),
      controller.getUniswapPoolFee()
    );

    emit MinAmountOut(minAmountOut);
  }

  function curveSwapTest(uint256 _amount, address _tokenIn, address _tokenOut) external {
    Swap.swapStableCoins(
      Swap.SwapInOut(_amount, _tokenIn, _tokenOut),
      uScale,
      1000000000000000000,
      controller.getCurveParams(_tokenIn, _tokenOut)
    );
  }

  function testLargeGameplayerSet(uint256 _amountOfPlayers) public {
    for (uint256 i = 0; i < _amountOfPlayers; i++) {
      players[i] = exchangeRate;
    }
  }

  function setVaultState(uint256 _state) external {
    if (_state == 0) state = State.Idle;
    if (_state == 1) state = State.SendingFundsXChain;
    if (_state == 2) state = State.WaitingForFunds;
    if (_state == 3) state = State.RebalanceVault;
  }

  function storePriceAndRewardsTest(uint256 _totalUnderlying, uint256 _protocolId) external {
    storePriceAndRewards(_totalUnderlying, _protocolId);
  }

  // function testFormulaWithNRoot(uint256 _g, uint256 _n) public view returns(int128) {
  //   int128 g_casted = ABDKMath64x64.fromUInt(_g);
  //   int128 n_casted = ABDKMath64x64.fromUInt(_n);
  //   int128 log2 = ABDKMath64x64.log_2(g_casted);
  //   int128 endResult = ABDKMath64x64.exp_2(log2 / n_casted);
  //   return endResult;
  // }
}
