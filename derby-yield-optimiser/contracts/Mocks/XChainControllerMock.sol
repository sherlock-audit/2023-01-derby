// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../XChainController.sol";

contract XChainControllerMock is XChainController {
  constructor(
    address _game,
    address _dao,
    address _guardian,
    uint32 _homeChain
  ) XChainController(_game, _dao, _guardian, _homeChain) {}

  function setActiveVaultsTEST(uint256 _vaultNumber, uint256 _activeVaults) external {
    return setActiveVaults(_vaultNumber, _activeVaults);
  }

  function setReadyTEST(uint256 _vaultNumber, bool _state) external {
    return setReady(_vaultNumber, _state);
  }

  function setAllocationsReceivedTEST(uint256 _vaultNumber, bool _state) external {
    return setAllocationsReceived(_vaultNumber, _state);
  }

  function upUnderlyingReceivedTEST(uint256 _vaultNumber) external {
    return upUnderlyingReceived(_vaultNumber);
  }

  function resetVaultStagesTEST(uint256 _vaultNumber) external {
    return resetVaultStages(_vaultNumber);
  }

  // function upFundsReceivedTEST(uint256 _vaultNumber) external {
  //   return upFundsReceived(_vaultNumber);
  // }

  function getVaultReadyState(uint256 _vaultNumber) external view returns (bool) {
    return vaultStage[_vaultNumber].ready;
  }

  function getAllocationState(uint256 _vaultNumber) external view returns (bool) {
    return vaultStage[_vaultNumber].allocationsReceived;
  }

  function getUnderlyingState(uint256 _vaultNumber) external view returns (uint256) {
    return vaultStage[_vaultNumber].underlyingReceived;
  }

  function getFundsReceivedState(uint256 _vaultNumber) external view returns (uint256) {
    return vaultStage[_vaultNumber].fundsReceived;
  }

  function getCurrentTotalAllocationTEST(uint256 _vaultNumber) external view returns (int256) {
    return getCurrentTotalAllocation(_vaultNumber);
  }

  function getCurrentAllocationTEST(
    uint256 _vaultNumber,
    uint32 _chainId
  ) external view returns (int256) {
    return getCurrentAllocation(_vaultNumber, _chainId);
  }

  function getTotalUnderlyingOnChainTEST(
    uint256 _vaultNumber,
    uint32 _chainId
  ) external view returns (uint256) {
    return getTotalUnderlyingOnChain(_vaultNumber, _chainId);
  }

  function getTotalSupplyTEST(uint256 _vaultNumber) external view returns (uint256) {
    return getTotalSupply(_vaultNumber);
  }

  function getWithdrawalRequestsTEST(
    uint256 _vaultNumber,
    uint32 _chainId
  ) external view returns (uint256) {
    return getWithdrawalRequests(_vaultNumber, _chainId);
  }

  function getTotalWithdrawalRequestsTEST(uint256 _vaultNumber) external view returns (uint256) {
    return getTotalWithdrawalRequests(_vaultNumber);
  }

  function getTotalUnderlyingVaultTEST(uint256 _vaultNumber) external view returns (uint256) {
    return vaults[_vaultNumber].totalUnderlying;
  }

  function getUnderlyingAddressTEST(
    uint256 _vaultNumber,
    uint32 _chainId
  ) external view returns (address) {
    return getUnderlyingAddress(_vaultNumber, _chainId);
  }

  function getVaultAddressTEST(
    uint256 _vaultNumber,
    uint32 _chainId
  ) external view returns (address) {
    return getVaultAddress(_vaultNumber, _chainId);
  }
}
