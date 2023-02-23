// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IIdle {
  function mintIdleToken(
    uint _amount,
    bool _skipRebalance,
    address _referral
  ) external returns (uint);

  function redeemIdleToken(uint _amount) external returns (uint);

  function tokenPrice() external view returns (uint);

  function decimals() external view returns (uint);

  function token() external view returns (address);

  function balanceOf(address _address) external view returns (uint);

  function transfer(address _receiver, uint _amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
