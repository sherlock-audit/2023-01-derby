// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "../VaultToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault is VaultToken {
  using SafeERC20 for IERC20;

  uint256 public savedTotalUnderlying;
  uint256 public exchangeRate;
  address public vaultCurrencyAddr;
  uint256 public rebalancingPeriod = 1;

  uint256 internal totalWithdrawalRequests;
  mapping(address => uint256) internal withdrawalAllowance;
  mapping(address => uint256) internal withdrawalRequestPeriod;

  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _savedTotalUnderlying,
    uint256 _exchangeRate,
    address _vaultCurrencyAddr
  ) VaultToken(_name, _symbol, _decimals) {
    savedTotalUnderlying = _savedTotalUnderlying;
    exchangeRate = _exchangeRate;
    vaultCurrencyAddr = _vaultCurrencyAddr;
  }

  function getVaultBalance() public view virtual returns (uint256) {
    return IERC20(vaultCurrencyAddr).balanceOf(address(this));
  }

  function setExchangeRate(uint256 _exchangeRate) external {
    exchangeRate = _exchangeRate;
  }

  function setTotalUnderlying(uint256 _totalUnderlying) external {
    savedTotalUnderlying = _totalUnderlying;
  }

  function upRebalancingPeriod() external {
    rebalancingPeriod++;
  }

  function deposit(uint256 _amount) external returns (uint256 shares) {
    uint256 balanceBefore = getVaultBalance();
    IERC20(vaultCurrencyAddr).safeTransferFrom(msg.sender, address(this), _amount);
    uint256 balanceAfter = getVaultBalance();

    uint256 amount = balanceAfter - balanceBefore;
    shares = (amount * (10**decimals())) / exchangeRate;

    _mint(msg.sender, shares);
  }

  function withdraw(uint256 _amount) external returns (uint256 value) {
    value = (_amount * exchangeRate) / (10**decimals());

    require(value > 0, "No value");

    require(getVaultBalance() >= value, "Not enough funds");

    _burn(msg.sender, _amount);
    IERC20(vaultCurrencyAddr).safeTransfer(msg.sender, value);
  }

  function withdrawalRequest(uint256 _amount) external returns (uint256 value) {
    require(withdrawalRequestPeriod[msg.sender] == 0, "Already a withdrawal request open");

    value = (_amount * exchangeRate) / (10**decimals());

    _burn(msg.sender, _amount);

    withdrawalAllowance[msg.sender] = value;
    withdrawalRequestPeriod[msg.sender] = rebalancingPeriod;
    totalWithdrawalRequests += value;
  }

  function withdrawAllowance() external returns (uint256 value) {
    require(withdrawalAllowance[msg.sender] > 0, "No allowance");
    require(rebalancingPeriod > withdrawalRequestPeriod[msg.sender], "Funds not reserved yet");

    value = withdrawalAllowance[msg.sender];

    require(getVaultBalance() >= value, "Not enough funds");

    delete withdrawalAllowance[msg.sender];
    delete withdrawalRequestPeriod[msg.sender];

    IERC20(vaultCurrencyAddr).safeTransfer(msg.sender, value);
  }
}
