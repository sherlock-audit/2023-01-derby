// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface ICToken {
  function balanceOf(address owner) external view returns (uint);

  function mint(uint) external returns (uint);

  function exchangeRateStored() external view returns (uint);

  function underlying() external view returns (address);

  function redeem(uint _amount) external returns (uint);

  function transfer(address _address, uint _amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
