// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

interface IStableSwap3Pool {
  function exchange(
    int128 i,
    int128 j,
    uint256 dx,
    uint256 min_dy
  ) external;
}
