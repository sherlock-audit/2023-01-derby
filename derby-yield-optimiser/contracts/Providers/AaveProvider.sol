// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../Interfaces/ExternalInterfaces/IAToken.sol";
import "../Interfaces/ExternalInterfaces/IALendingPool.sol";
import "../Interfaces/IProvider.sol";

contract AaveProvider is IProvider {
  using SafeERC20 for IERC20;

  /// @notice Deposit the underlying asset in Aave
  /// @dev Pulls underlying asset from Vault, deposit them in Aave, send aTokens back.
  /// @param _amount Amount to deposit
  /// @param _uToken Address of underlying Token eg USDC
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return Tokens received and sent to vault
  function deposit(
    uint256 _amount,
    address _aToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    IERC20(_uToken).safeTransferFrom(msg.sender, address(this), _amount);
    IERC20(_uToken).safeIncreaseAllowance(address(IAToken(_aToken).POOL()), _amount);

    uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    IALendingPool(IAToken(_aToken).POOL()).deposit(
      IAToken(_aToken).UNDERLYING_ASSET_ADDRESS(),
      _amount,
      msg.sender,
      0
    );

    return _amount;
  }

  /// @notice Withdraw the underlying asset from Aave
  /// @dev Pulls cTokens from Vault, redeem them from Aave, send underlying back.
  /// @param _amount Amount to withdraw
  /// @param _uToken Address of underlying Token eg USDC
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    uint256 _amount,
    address _aToken,
    address _uToken
  ) external override returns (uint256) {
    uint256 balanceBefore = IERC20(_uToken).balanceOf(msg.sender);

    require(
      IAToken(_aToken).transferFrom(msg.sender, address(this), _amount) == true,
      "Error: transferFrom"
    );
    uint256 uTokensReceived = IALendingPool(IAToken(_aToken).POOL()).withdraw(
      IAToken(_aToken).UNDERLYING_ASSET_ADDRESS(),
      _amount,
      msg.sender
    );

    uint256 balanceAfter = IERC20(_uToken).balanceOf(msg.sender);

    require(
      (balanceAfter - balanceBefore - uTokensReceived) == 0,
      "Error Withdraw: under/overflow"
    );

    return uTokensReceived;
  }

  /// @notice Get balance from address in shares i.e LP tokens
  /// @param _address Address to request balance from, most likely an Vault
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return number of shares i.e LP tokens
  function balanceUnderlying(
    address _address,
    address _aToken
  ) public view override returns (uint256) {
    uint256 balanceShares = balance(_address, _aToken);
    return balanceShares;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev Aave exchangeRate is 1
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _aToken) external view override returns (uint256) {
    uint256 shares = _amount / exchangeRate(_aToken);
    return shares;
  }

  /// @notice Get balance of aToken from address
  /// @param _address Address to request balance from
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _aToken) public view override returns (uint256) {
    uint256 _balanceShares = IAToken(_aToken).balanceOf(_address);
    return _balanceShares;
  }

  /// @notice Exchange rate of underyling protocol token
  /// @dev Aave exchangeRate is always 1
  /// @param _aToken Address of protocol LP Token eg aUSDC
  /// @return price of LP token
  function exchangeRate(address _aToken) public pure override returns (uint256) {
    return 1;
  }

  function claim(address _aToken, address _claimer) public override returns (bool) {}
}
