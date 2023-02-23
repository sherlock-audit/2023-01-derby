// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "../Interfaces/ExternalInterfaces/ITruefi.sol";
import "../Interfaces/IProvider.sol";

import "hardhat/console.sol";

contract NameProvider is IProvider {
  using SafeERC20 for IERC20;

  address public controller; 
  
  mapping(uint256 => uint256) public historicalPrices;

  modifier onlyController {
    require(msg.sender == controller, "ETFProvider: only controller");
    _;
  }

  constructor(address _controller) {
    controller = _controller;
  }

  /// @notice Deposit the underlying asset in TrueFi
  /// @dev Pulls underlying asset from Vault, deposit them in TrueFi, send tTokens back.
  /// @param _vault Address from Vault contract i.e buyer
  /// @param _amount Amount to deposit
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Tokens received and sent to vault
  function deposit(
    address _vault, 
    uint256 _amount, 
    address _tToken,
    address _uToken
  ) external override onlyController returns(uint256) {
    // uint256 balanceBefore = IERC20(_uToken).balanceOf(address(this));

    // IERC20(_uToken).safeTransferFrom(_vault, address(this), _amount);
    // IERC20(_uToken).safeIncreaseAllowance(_tToken, _amount);

    // uint256 balanceAfter = IERC20(_uToken).balanceOf(address(this));
    // require((balanceAfter - balanceBefore - _amount) == 0, "Error Deposit: under/overflow");

    // uint256 tTokenBefore = ITruefi(_tToken).balanceOf(address(this));
    // ITruefi(_tToken).join(_amount);
    // uint256 tTokenAfter = ITruefi(_tToken).balanceOf(address(this));

    // uint tTokensReceived = tTokenAfter - tTokenBefore;

    // ITruefi(_tToken).transfer(_vault, tTokensReceived);
    
    // return tTokensReceived;
  }

  /// @notice Withdraw the underlying asset from TrueFi
  /// @dev Pulls tTokens from Vault, redeem them from TrueFi, send underlying back.
  /// @param _vault Address from Vault contract i.e buyer
  /// @param _amount Amount to withdraw
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @param _uToken Address of underlying Token eg USDC
  /// @return Underlying tokens received and sent to vault e.g USDC
  function withdraw(
    address _vault, 
    uint256 _amount, 
    address _tToken,
    address _uToken
  ) external override onlyController returns(uint256) {
    // uint256 balanceBefore = IERC20(_uToken).balanceOf(_vault); 

    // uint256 balanceBeforeRedeem = IERC20(_uToken).balanceOf(address(this)); 

    // require(ITruefi(_tToken).transferFrom(_vault, address(this), _amount) == true, "Error: transferFrom");
    // ITruefi(_tToken).liquidExit(_amount); 
    
    // uint256 balanceAfterRedeem = IERC20(_uToken).balanceOf(address(this)); 
    // uint256 uTokensReceived = balanceAfterRedeem - balanceBeforeRedeem;

    // IERC20(_uToken).safeTransfer(_vault, uTokensReceived);

    // uint256 balanceAfter = IERC20(_uToken).balanceOf(_vault); 
    // require((balanceAfter - balanceBefore - uTokensReceived) == 0, "Error Withdraw: under/overflow");

    // return uTokensReceived;
  }

  /// @notice Get balance from address in underlying token
  /// @dev balance = poolvalue * shares / totalsupply
  /// @param _address Address to request balance from, most likely an Vault
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return balance in underlying token
  function balanceUnderlying(address _address, address _tToken) public view override returns(uint256) {
    // uint256 shares = balance(_address, _tToken);
    // uint256 balance = ITruefi(_tToken).poolValue() * shares / ITruefi(_tToken).totalSupply();
    // return balance;
  }

  /// @notice Calculates how many shares are equal to the amount
  /// @dev shares = totalsupply * balance / poolvalue
  /// @param _amount Amount in underyling token e.g USDC
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function calcShares(uint256 _amount, address _tToken) external view override returns(uint256) {
    // uint256 shares = ITruefi(_tToken).totalSupply() * _amount / ITruefi(_tToken).poolValue();
    // return shares;
  }

  /// @notice Get balance of cToken from address
  /// @param _address Address to request balance from
  /// @param _tToken Address of protocol LP Token eg cUSDC
  /// @return number of shares i.e LP tokens
  function balance(address _address, address _tToken) public view override returns(uint256) {
    // return ITruefi(_tToken).balanceOf(_address);
  }

  // not used by truefi, can maybe deleted everywhere?
  function exchangeRate(address _tToken) public view override returns(uint256) {

  }

  function claim(address _tToken, address _claimer) external override returns(bool) {

  }

}