// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../Interfaces/IController.sol";

import "../Interfaces/ExternalInterfaces/ISwapRouter.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Factory.sol";
import "../Interfaces/ExternalInterfaces/IUniswapV3Pool.sol";
import "../Interfaces/ExternalInterfaces/IStableSwap3Pool.sol";
import "../Interfaces/ExternalInterfaces/IWETH.sol";
import "../Interfaces/ExternalInterfaces/IQuoter.sol";

import "hardhat/console.sol";

library Swap {
  using SafeERC20 for IERC20;

  struct SwapInOut {
    uint256 amount;
    address tokenIn;
    address tokenOut;
  }

  address internal constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  uint256 internal constant gasUsedForSwap = 210000;

  /// @notice Swap stable coins on Curve
  /// @param _swap Number of tokens to sell, token to sell, token to receive
  /// @param _tokenInUScale Scale of tokenIn e.g 1E6
  /// @param _tokenOutUScale Scale of tokenOut e.g 1E6
  /// @param _curve Curve pool index number of TokenIn address, tokenOut address, pool address and pool fee
  function swapStableCoins(
    SwapInOut memory _swap,
    uint256 _tokenInUScale,
    uint256 _tokenOutUScale,
    IController.CurveParams memory _curve
  ) public returns (uint256) {
    uint256 amountOutMin = (((_swap.amount * (10000 - _curve.poolFee)) / 10000) * _tokenOutUScale) /
      _tokenInUScale;
    IERC20(_swap.tokenIn).safeIncreaseAllowance(_curve.pool, _swap.amount);

    uint256 balanceBefore = IERC20(_swap.tokenOut).balanceOf(address(this));

    IStableSwap3Pool(_curve.pool).exchange(
      _curve.indexTokenIn,
      _curve.indexTokenOut,
      _swap.amount,
      amountOutMin
    );

    uint256 balanceAfter = IERC20(_swap.tokenOut).balanceOf(address(this));

    return balanceAfter - balanceBefore;
  }

  /// @notice Swap tokens on Uniswap
  /// @param _swap Number of tokens to sell, token to sell, token to receive
  /// @param _uniswap Address of uniswapRouter, uniswapQuoter and poolfee
  /// @return Amountout Number of tokens received
  function swapTokensMulti(
    SwapInOut memory _swap,
    IController.UniswapParams memory _uniswap,
    bool _rewardSwap
  ) public returns (uint256) {
    IERC20(_swap.tokenIn).safeIncreaseAllowance(_uniswap.router, _swap.amount);

    uint256 amountOutMinimum = IQuoter(_uniswap.quoter).quoteExactInput(
      abi.encodePacked(_swap.tokenIn, _uniswap.poolFee, WETH, _uniswap.poolFee, _swap.tokenOut),
      _swap.amount
    );

    uint256 balanceBefore = IERC20(_swap.tokenOut).balanceOf(address(this));
    if (_rewardSwap && balanceBefore > amountOutMinimum) return amountOutMinimum;

    ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
      path: abi.encodePacked(
        _swap.tokenIn,
        _uniswap.poolFee,
        WETH,
        _uniswap.poolFee,
        _swap.tokenOut
      ),
      recipient: address(this),
      deadline: block.timestamp,
      amountIn: _swap.amount,
      amountOutMinimum: amountOutMinimum
    });

    ISwapRouter(_uniswap.router).exactInput(params);
    uint256 balanceAfter = IERC20(_swap.tokenOut).balanceOf(address(this));

    return balanceAfter - balanceBefore;
  }

  /// @notice Swap tokens on Uniswap Multi route
  /// @param _swap Number of tokens to sell, token to sell, token to receive
  /// @param _uniswapQuoter Address of uniswapQuoter
  /// @param _poolFee Current uniswap pool fee set in router e.g 3000
  /// @return amountOutMin minimum amount out of tokens to receive when executing swap
  function amountOutMultiSwap(
    SwapInOut memory _swap,
    address _uniswapQuoter,
    uint24 _poolFee
  ) public returns (uint256) {
    return
      IQuoter(_uniswapQuoter).quoteExactInput(
        abi.encodePacked(_swap.tokenIn, _poolFee, WETH, _poolFee, _swap.tokenOut),
        _swap.amount
      );
  }
}
