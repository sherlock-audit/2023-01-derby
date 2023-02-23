// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/ITruefi.sol";
import "../Interfaces/IProvider.sol";

contract TruefiProvider is IProvider {
  using SafeERC20 for IERC20;

  /// @notice Deposit the underlying asset in TrueFi
  /// @dev Pulls underlying asset from Vault, deposit them in TrueFi, send tTokens back.
  /// @param _amount Amount to deposit
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    uint256 _amount,
    address _tToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(msg.sender, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_tToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 tTokenBefore = ITruefi(_tToken).balanceOf(address(this));
    ITruefi(_tToken).join(_amount);
    uint256 tTokenAfter = ITruefi(_tToken).balanceOf(address(this));

    uint tTokensReceived = tTokenAfter - tTokenBefore;

    ITruefi(_tToken).transfer(msg.sender, tTokensReceived);

    return tTokensReceived;
  }

  /// @notice Withdraw the underlying asset from TrueFi
  /// @dev Pulls tTokens from Vault, redeem them from TrueFi, send underlying back.
  /// @param _amount Amount to withdraw
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    uint256 _amount,
    address _tToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(msg.sender);

    uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this));

    require(
      ITruefi(_tToken).transferFrom(msg.sender, address(this), _amount) == true,
      "Error: transferFrom"
    );
    ITruefi(_tToken).liquidExit(_amount);

    uint256 balanceAfterRedeem = IERC20(_uToken).balanceOf(address(this));
    uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    IERC20(_uToken).safeTransfer(msg.sender, uTokensReceived);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(msg.sender);
    require(
      (balanceAfter - balanceBefore - uTokensReceived) == 0,
      "Error Withdraw: under/overflow"
    );

    return uTokensReceived;
  }

  /// @notice Get balance from address in underlying token
  /// @dev balance = poolvalue * shares / totalsupply
  /// @param _address Address to request balance from, most likely an Vault
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(
    address _address,
    address _tToken
  ) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _tToken);
    uint256 currentBalance = (ITruefi(_tToken).poolValue() * balanceShares) /
      ITruefi(_tToken).totalSupply();
    return currentBalance;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev shares = totalsupply * balance / poolvalue
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _tToken) external view override returns (uint256) {
    uint256 shares = (ITruefi(_tToken).totalSupply() * _amount) / ITruefi(_tToken).poolValue();
    return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _tToken) public view override returns (uint256) {
    return ITruefi(_tToken).balanceOf(_address);
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev returned price from compound is scaled by 1e18
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return price of LP token
  function exchangeRate(address _tToken) public view override returns (uint256) {
    uint256 poolValue = ITruefi(_tToken).poolValue();
    uint256 totalSupply = ITruefi(_tToken).totalSupply();
    return (poolValue * 1E6) / totalSupply;
  }

  function claim(address _tToken, address _claimer) external override returns (bool) {}
}
