// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IExecutor {
  /**
   * @param _transferId Unique identifier of transaction id that necessitated
   * calldata execution
   * @param _amount The amount to approve or send with the call
   * @param _to The address to execute the calldata on
   * @param _assetId The assetId of the funds to approve to the contract or
   * send along with the call
   * @param _properties The origin properties
   * @param _callData The data to execute
   */
  struct ExecutorArgs {
    bytes32 transferId;
    uint256 amount;
    address to;
    address recovery;
    address assetId;
    bytes properties;
    bytes callData;
  }

  function originSender() external returns (address);

  function origin() external returns (uint32);

  function execute(ExecutorArgs calldata _args)
    external
    payable
    returns (bool success, bytes memory returnData);
}
