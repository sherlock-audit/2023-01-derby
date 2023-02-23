// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IXChainController {
  function addTotalChainUnderlying(uint256 _vaultNumber, uint256 _amount) external;

  function upFundsReceived(uint256 _vaultNumber) external;

  function receiveAllocationsFromGame(uint256 _vaultNumber, int256[] memory _deltas) external;

  function setTotalUnderlying(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _underlying,
    uint256 _totalSupply,
    uint256 _withdrawalRequests
  ) external;
}
