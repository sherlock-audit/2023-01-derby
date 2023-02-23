// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IBeta {
  function mint(address _to, uint _amount) external returns (uint);

  function burn(address _to, uint _amount) external returns (uint);

  function totalSupply() external view returns (uint);

  function totalLoanable() external view returns (uint);

  function totalLoan() external view returns (uint);

  function balanceOf(address _address) external view returns (uint);

  function transfer(address _receiver, uint _amount) external returns (bool);

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external returns (bool);
}
