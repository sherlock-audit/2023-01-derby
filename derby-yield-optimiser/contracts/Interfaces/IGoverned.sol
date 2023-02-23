// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

abstract contract IGoverned {
  address public dao;
  address public guardian;

  modifier onlyDao() {
    require(dao == msg.sender, "GOV: not dao");
    _;
  }

  modifier onlyDaoOrGuardian() {
    require(msg.sender == dao || msg.sender == guardian, "GOV: not dao/guardian");
    _;
  }

  constructor() {
    dao = msg.sender;
    guardian = msg.sender;
  }

  function setDao(address dao_) external onlyDao {
    dao = dao_;
  }

  function setGuardian(address guardian_) external onlyDao {
    guardian = guardian_;
  }
}
