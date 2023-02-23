// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../VaultToken.sol";

import "hardhat/console.sol";

contract YearnVaultMock is VaultToken {
  using SafeERC20 for IERC20;

  uint256 public exchangeRate;
  address public vaultCurrencyAddr;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _vaultCurrency,
    uint256 _exchangeRate
  ) VaultToken(_name, _symbol, _decimals) {
    exchangeRate = _exchangeRate;
    vaultCurrencyAddr = _vaultCurrency;
  }

  function deposit(uint256 _amount) external returns (uint256 shares) {
    uint256 balanceBefore = getVaultBalance();
    IERC20(vaultCurrencyAddr).safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    shares = (amount * (10 ** decimals())) / exchangeRate;

    _mint(msg.sender, shares);
  }

  function withdraw(uint256 _amount) external returns (uint256 value) {
    value = (_amount * exchangeRate) / (10 ** decimals());

    require(value > 0, "No value");
    require(getVaultBalance() >= value, "Not enough funds");

    _burn(msg.sender, _amount);
    IERC20(vaultCurrencyAddr).safeTransfer(msg.sender, value);
  }

  function pricePerShare() external view returns (uint256) {
    return exchangeRate;
  }

  function getVaultBalance() public view virtual returns (uint256) {
    return IERC20(vaultCurrencyAddr).balanceOf(address(this));
  }

  function setExchangeRate(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }
}
