// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract VaultToken is ERC20 {
  uint8 private decimals_;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) ERC20(_name, _symbol) {
    decimals_ = _decimals;
  }

  function decimals() public view virtual override returns (uint8) {
    return decimals_;
  }
}
