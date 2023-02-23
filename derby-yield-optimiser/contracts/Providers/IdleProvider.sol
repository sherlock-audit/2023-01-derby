// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IIdle.sol";
import "../Interfaces/IProvider.sol";

contract IdleProvider is IProvider {
  using SafeERC20 for IERC20;

  /// @notice Deposit the underlying asset in Idle
  /// @dev Pulls underlying asset from Vault, deposit them in Idle, send tTokens back.
  /// @param _amount Amount to deposit
  /// @param _iToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    uint256 _amount,
    address _iToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(msg.sender, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(_iToken, _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    uint256 tTokenBefore = IIdle(_iToken).balanceOf(address(this));
    // expensive mint
    IIdle(_iToken).mintIdleToken(_amount, true, address(0));
    uint256 tTokenAfter = IIdle(_iToken).balanceOf(address(this));

    uint tTokensReceived = tTokenAfter - tTokenBefore;
    IIdle(_iToken).transfer(msg.sender, tTokensReceived);

    return tTokensReceived;
  }

  /// @notice Withdraw the underlying asset from Idle
  /// @dev Pulls tTokens from Vault, redeem them from Idle, send underlying back.
  /// @param _amount Amount to withdraw
  /// @param _iToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    uint256 _amount,
    address _iToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(msg.sender);

    uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this));

    require(
      IIdle(_iToken).transferFrom(msg.sender, address(this), _amount) == true,
      "Error: transferFrom"
    );
    IIdle(_iToken).redeemIdleToken(_amount);

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
  /// @param _iToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(
    address _address,
    address _iToken
  ) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _iToken);
    uint256 price = exchangeRate(_iToken);
    uint256 decimals = IERC20Metadata(IIdle(_iToken).token()).decimals();
    return (balanceShares * price) / 10 ** decimals;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev shares = totalsupply * balance / poolvalue
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _iToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _iToken) external view override returns (uint256) {
    uint256 decimals = IERC20Metadata(IIdle(_iToken).token()).decimals();
    uint256 shares = (_amount * (10 ** decimals)) / exchangeRate(_iToken);
    return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _iToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _iToken) public view override returns (uint256) {
    return IIdle(_iToken).balanceOf(_address);
  }

  /// @notice Exchange rate of underyling protocol token
  /// @param _iToken Address of protocol LP Token eg yUSDC
  /// @return price of LP token
  function exchangeRate(address _iToken) public view override returns (uint256) {
    return IIdle(_iToken).tokenPrice();
  }

  function claim(address _iToken, address _claimer) external override returns (bool) {}
}
