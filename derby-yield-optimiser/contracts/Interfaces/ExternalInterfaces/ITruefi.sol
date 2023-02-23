// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface ITruefi {
  function join(uint _amount) external;

  function liquidExit(uint _amount) external;

  function balanceOf(address _address) external view returns (uint);

  function poolValue() external view returns (uint);

  function totalSupply() external view returns (uint);

  function transfer(address _receiver, uint _amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
