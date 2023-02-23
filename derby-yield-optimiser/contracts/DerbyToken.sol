// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DerbyToken is ERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint256 _totalSupply
  ) ERC20(_name, _symbol) {
    _mint(msg.sender, _totalSupply);
  }
}
