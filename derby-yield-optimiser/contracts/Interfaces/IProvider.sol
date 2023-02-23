// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

interface IProvider {
  function deposit(
    uint256 _amount,
    address _uToken,
    address _protocolLPToken
  ) external returns (uint256);

  function withdraw(
    uint256 _amount,
    address _uToken,
    address _protocolLPToken
  ) external returns (uint256);

  function exchangeRate(address _protocolLPToken) external view returns (uint256);

  function balanceUnderlying(address _address, address _protocolLPToken)
    external
    view
    returns (uint256);

  function calcShares(uint256 _amount, address _protocolLPToken) external view returns (uint256);

  function balance(address _address, address _protocolLPToken) external view returns (uint256);

  function claim(address _protocolLPToken, address _claimer) external returns (bool);
}
