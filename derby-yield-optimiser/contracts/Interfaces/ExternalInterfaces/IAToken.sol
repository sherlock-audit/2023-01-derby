// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IAToken {
  function scaledBalanceOf(address user) external view returns (uint256);

  function POOL() external view returns (address);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function balanceOf(address user) external view returns (uint256);

  function pricePerShare() external view returns (uint);

  function transfer(address _receiver, uint _amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);

  function approve(address spender, uint256 amount) external returns (bool);
}
