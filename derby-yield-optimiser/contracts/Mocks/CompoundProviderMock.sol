// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../Providers/CompoundProvider.sol";

contract CompoundProviderMock is CompoundProvider {
  constructor(address _comptroller) CompoundProvider(_comptroller) {}

  function claimTest(address _address, address _cToken) public {
    address[] memory cTokens = new address[](1);
    cTokens[0] = _cToken;
    comptroller.claimComp(_address, cTokens);
  }
}
