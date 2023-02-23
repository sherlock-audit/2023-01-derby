// SPDX-License-Identifier: MIT
// Derby Finance - 2022
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./DerbyToken.sol";

import "./Interfaces/IVault.sol";
import "./Interfaces/IController.sol";
import "./Interfaces/IXProvider.sol";

contract Game is ERC721, ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct Basket {
    // the vault number for which this Basket was created
    uint256 vaultNumber;
    // last period when this Basket got rebalanced
    uint256 lastRebalancingPeriod;
    // nr of total allocated tokens
    int256 nrOfAllocatedTokens;
    // total build up rewards
    int256 totalUnRedeemedRewards;
    // total redeemed rewards
    int256 totalRedeemedRewards;
    // (basket => vaultNumber => chainId => allocation)
    mapping(uint256 => mapping(uint256 => int256)) allocations;
  }

  struct vaultInfo {
    // rebalance period of vault, upped at vault rebalance
    uint256 rebalancingPeriod;
    // (chainId => vaultAddress)
    mapping(uint32 => address) vaultAddress;
    // (chainId => deltaAllocation)
    mapping(uint256 => int256) deltaAllocationChain;
    // (chainId => protocolNumber => deltaAllocation)
    mapping(uint256 => mapping(uint256 => int256)) deltaAllocationProtocol;
    // (chainId => rebalancing period => protocol id => rewardPerLockedToken).
    mapping(uint32 => mapping(uint256 => mapping(uint256 => int256))) rewardPerLockedToken;
  }

  address private dao;
  address private guardian;
  address public xProvider;
  address public homeVault;

  IController public controller;
  IERC20 public derbyToken;

  // latest basket id
  uint256 private latestBasketId;

  // array of chainIds e.g [10, 100, 1000];
  uint32[] public chainIds;

  // interval in Unix timeStamp
  uint256 public rebalanceInterval; // SHOULD BE REPLACED FOR REALISTIC NUMBER

  // last rebalance timeStamp
  uint256 public lastTimeStamp;

  // threshold in vaultCurrency e.g USDC for when user tokens will be sold / burned. Must be negative
  int256 internal negativeRewardThreshold;
  // percentage of tokens that will be sold at negative rewards
  uint256 internal negativeRewardFactor;

  // baskets, maps tokenID from BasketToken NFT contract to the Basket struct in this contract.
  // (basketTokenId => basket struct):
  mapping(uint256 => Basket) private baskets;

  // (chainId => latestProtocolId): latestProtocolId set by dao
  mapping(uint256 => uint256) public latestProtocolId;

  // (vaultNumber => vaultInfo struct)
  mapping(uint256 => vaultInfo) internal vaults;

  // (vaultNumber => chainid => bool): true when vault/ chainid is cross-chain rebalancing
  mapping(uint256 => mapping(uint32 => bool)) public isXChainRebalancing;

  event PushProtocolAllocations(uint32 chain, address vault, int256[] deltas);

  event PushedAllocationsToController(uint256 vaultNumber, int256[] deltas);

  event BasketId(address owner, uint256 basketId);

  modifier onlyDao() {
    require(msg.sender == dao, "Game: only DAO");
    _;
  }

  modifier onlyBasketOwner(uint256 _basketId) {
    require(msg.sender == ownerOf(_basketId), "Game: Not the owner of the basket");
    _;
  }

  modifier onlyXProvider() {
    require(msg.sender == xProvider, "Game: only xProvider");
    _;
  }

  modifier onlyGuardian() {
    require(msg.sender == guardian, "Game: only Guardian");
    _;
  }

  constructor(
    string memory name_,
    string memory symbol_,
    address _derbyToken,
    address _dao,
    address _guardian,
    address _controller
  ) ERC721(name_, symbol_) {
    derbyToken = IERC20(_derbyToken);
    controller = IController(_controller);
    dao = _dao;
    guardian = _guardian;
    lastTimeStamp = block.timestamp;
  }

  /// @notice Setter for delta allocation in a particulair chainId
  /// @param _vaultNumber number of vault
  /// @param _chainId number of chainId
  /// @param _deltaAllocation delta allocation
  function addDeltaAllocationChain(
    uint256 _vaultNumber,
    uint256 _chainId,
    int256 _deltaAllocation
  ) internal {
    vaults[_vaultNumber].deltaAllocationChain[_chainId] += _deltaAllocation;
  }

  /// @notice Getter for delta allocation in a particulair chainId
  /// @param _vaultNumber number of vault
  /// @param _chainId number of chainId
  /// @return allocation delta allocation
  function getDeltaAllocationChain(
    uint256 _vaultNumber,
    uint256 _chainId
  ) public view returns (int256) {
    return vaults[_vaultNumber].deltaAllocationChain[_chainId];
  }

  /// @notice Setter for the delta allocation in Protocol vault e.g compound_usdc_01
  /// @dev Allocation can be negative
  /// @param _vaultNumber number of vault
  /// @param _chainId number of chainId
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @param _deltaAllocation Delta allocation in tokens
  function addDeltaAllocationProtocol(
    uint256 _vaultNumber,
    uint256 _chainId,
    uint256 _protocolNum,
    int256 _deltaAllocation
  ) internal {
    vaults[_vaultNumber].deltaAllocationProtocol[_chainId][_protocolNum] += _deltaAllocation;
  }

  /// @notice Getter for the delta allocation in Protocol vault e.g compound_usdc_01
  /// @param _vaultNumber number of vault
  /// @param _chainId number of chainId
  /// @param _protocolNum Protocol number linked to an underlying vault e.g compound_usdc_01
  /// @return allocation Delta allocation in tokens
  function getDeltaAllocationProtocol(
    uint256 _vaultNumber,
    uint256 _chainId,
    uint256 _protocolNum
  ) public view returns (int256) {
    return vaults[_vaultNumber].deltaAllocationProtocol[_chainId][_protocolNum];
  }

  /// @notice Setter to set the total number of allocated tokens. Only the owner of the basket can set this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _allocation Number of derby tokens that are allocated towards protocols.
  function setBasketTotalAllocatedTokens(
    uint256 _basketId,
    int256 _allocation
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].nrOfAllocatedTokens += _allocation;
    require(basketTotalAllocatedTokens(_basketId) >= 0, "Basket: underflow");
  }

  /// @notice function to see the total number of allocated tokens. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Number of derby tokens that are allocated towards protocols.
  function basketTotalAllocatedTokens(uint256 _basketId) public view returns (int256) {
    return baskets[_basketId].nrOfAllocatedTokens;
  }

  /// @notice Setter to set the allocation of a specific protocol by a basketId. Only the owner of the basket can set this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _chainId number of chainId.
  /// @param _protocolId Id of the protocol of which the allocation is queried.
  /// @param _allocation Number of derby tokens that are allocated towards this specific protocol.
  function setBasketAllocationInProtocol(
    uint256 _basketId,
    uint256 _chainId,
    uint256 _protocolId,
    int256 _allocation
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].allocations[_chainId][_protocolId] += _allocation;
    require(basketAllocationInProtocol(_basketId, _chainId, _protocolId) >= 0, "Basket: underflow");
  }

  /// @notice function to see the allocation of a specific protocol by a basketId. Only the owner of the basket can view this
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _chainId number of chainId
  /// @param _protocolId Id of the protocol of which the allocation is queried
  /// @return int256 Number of derby tokens that are allocated towards this specific protocol
  function basketAllocationInProtocol(
    uint256 _basketId,
    uint256 _chainId,
    uint256 _protocolId
  ) public view onlyBasketOwner(_basketId) returns (int256) {
    return baskets[_basketId].allocations[_chainId][_protocolId];
  }

  /// @notice Setter for rebalancing period of the basket, used to calculate the rewards
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _vaultNumber number of vault
  function setBasketRebalancingPeriod(
    uint256 _basketId,
    uint256 _vaultNumber
  ) internal onlyBasketOwner(_basketId) {
    baskets[_basketId].lastRebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod + 1;
  }

  /// @notice function to see the total unredeemed rewards the basket has built up. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Total unredeemed rewards.
  function basketUnredeemedRewards(
    uint256 _basketId
  ) external view onlyBasketOwner(_basketId) returns (int256) {
    return baskets[_basketId].totalUnRedeemedRewards;
  }

  /// @notice function to see the total reeemed rewards from the basket. Only the owner of the basket can view this.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @return int256 Total redeemed rewards.
  function basketRedeemedRewards(
    uint256 _basketId
  ) external view onlyBasketOwner(_basketId) returns (int) {
    return baskets[_basketId].totalRedeemedRewards;
  }

  /// @notice Mints a new NFT with a Basket of allocations.
  /// @dev The basket NFT is minted for a specific vault, starts with a zero allocation and the tokens are not locked here.
  /// @param _vaultNumber Number of the vault. Same as in Router.
  /// @return basketId The basket Id the user has minted.
  function mintNewBasket(uint256 _vaultNumber) external returns (uint256) {
    // mint Basket with nrOfUnAllocatedTokens equal to _lockedTokenAmount
    baskets[latestBasketId].vaultNumber = _vaultNumber;
    baskets[latestBasketId].lastRebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod + 1;
    _safeMint(msg.sender, latestBasketId);
    latestBasketId++;

    emit BasketId(msg.sender, latestBasketId - 1);
    return latestBasketId - 1;
  }

  /// @notice Function to lock xaver tokens to a basket. They start out to be unallocated.
  /// @param _lockedTokenAmount Amount of xaver tokens to lock inside this contract.
  function lockTokensToBasket(uint256 _lockedTokenAmount) internal {
    uint256 balanceBefore = derbyToken.balanceOf(address(this));
    derbyToken.safeTransferFrom(msg.sender, address(this), _lockedTokenAmount);
    uint256 balanceAfter = derbyToken.balanceOf(address(this));

    require((balanceAfter - balanceBefore - _lockedTokenAmount) == 0, "Error lock: under/overflow");
  }

  /// @notice Function to unlock xaver tokens. If tokens are still allocated to protocols they first hevae to be unallocated.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _unlockedTokenAmount Amount of derby tokens to unlock and send to the user.
  function unlockTokensFromBasket(uint256 _basketId, uint256 _unlockedTokenAmount) internal {
    uint256 tokensBurned = redeemNegativeRewards(_basketId, _unlockedTokenAmount);
    uint256 tokensToUnlock = _unlockedTokenAmount -= tokensBurned;

    uint256 balanceBefore = derbyToken.balanceOf(address(this));
    derbyToken.safeTransfer(msg.sender, tokensToUnlock);
    uint256 balanceAfter = derbyToken.balanceOf(address(this));

    require((balanceBefore - balanceAfter - tokensToUnlock) == 0, "Error unlock: under/overflow");
  }

  /// @notice IMPORTANT: The negativeRewardFactor takes in account an approximation of the price of derby tokens by the dao
  /// @notice IMPORTANT: This will change to an exact price when there is a derby token liquidity pool
  /// @notice Calculates if there are any negative rewards and how many tokens to burn
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _unlockedTokens Amount of derby tokens to unlock and send to user
  /// @return tokensToBurn Amount of derby tokens that are burned
  function redeemNegativeRewards(
    uint256 _basketId,
    uint256 _unlockedTokens
  ) internal returns (uint256) {
    int256 unredeemedRewards = baskets[_basketId].totalUnRedeemedRewards;
    if (unredeemedRewards > negativeRewardThreshold) return 0;

    uint256 tokensToBurn = (uint(-unredeemedRewards) * negativeRewardFactor) / 100;
    tokensToBurn = tokensToBurn < _unlockedTokens ? tokensToBurn : _unlockedTokens;

    baskets[_basketId].totalUnRedeemedRewards += int((tokensToBurn * 100) / negativeRewardFactor);

    IERC20(derbyToken).safeTransfer(homeVault, tokensToBurn);

    return tokensToBurn;
  }

  /// @notice rebalances an existing Basket
  /// @dev First calculates the rewards the basket has built up, then sets the new allocations and communicates the deltas to the vault
  /// @dev Finally it locks or unlocks tokens
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18).
  function rebalanceBasket(
    uint256 _basketId,
    int256[][] memory _deltaAllocations
  ) external onlyBasketOwner(_basketId) nonReentrant {
    uint256 vaultNumber = baskets[_basketId].vaultNumber;
    for (uint k = 0; k < chainIds.length; k++) {
      require(!isXChainRebalancing[vaultNumber][chainIds[k]], "Game: vault is xChainRebalancing");
    }

    addToTotalRewards(_basketId);
    int256 totalDelta = settleDeltaAllocations(_basketId, vaultNumber, _deltaAllocations);

    lockOrUnlockTokens(_basketId, totalDelta);
    setBasketTotalAllocatedTokens(_basketId, totalDelta);
    setBasketRebalancingPeriod(_basketId, vaultNumber);
  }

  /// @notice Internal helper to calculate and settle the delta allocations from baskets
  /// @dev Sets the total allocations per ChainId, used in XChainController
  /// @dev Sets the total allocations per protocol number, used in Vaults
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _vaultNumber number of vault
  /// @param _deltaAllocations delta allocations set by the user of the basket. Allocations are scaled (so * 1E18)
  /// @return totalDelta total delta allocated tokens of the basket, used in lockOrUnlockTokens
  function settleDeltaAllocations(
    uint256 _basketId,
    uint256 _vaultNumber,
    int256[][] memory _deltaAllocations
  ) internal returns (int256 totalDelta) {
    for (uint256 i = 0; i < _deltaAllocations.length; i++) {
      int256 chainTotal;
      uint32 chain = chainIds[i];
      uint256 latestProtocol = latestProtocolId[chain];
      require(_deltaAllocations[i].length == latestProtocol, "Invalid allocation length");

      for (uint256 j = 0; j < latestProtocol; j++) {
        int256 allocation = _deltaAllocations[i][j];
        if (allocation == 0) continue;
        chainTotal += allocation;
        addDeltaAllocationProtocol(_vaultNumber, chain, j, allocation);
        setBasketAllocationInProtocol(_basketId, chain, j, allocation);
      }

      totalDelta += chainTotal;
      addDeltaAllocationChain(_vaultNumber, chain, chainTotal);
    }
  }

  /// @notice rewards are calculated here.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  function addToTotalRewards(uint256 _basketId) internal onlyBasketOwner(_basketId) {
    if (baskets[_basketId].nrOfAllocatedTokens == 0) return;

    uint256 vaultNum = baskets[_basketId].vaultNumber;
    uint256 currentRebalancingPeriod = vaults[vaultNum].rebalancingPeriod;
    uint256 lastRebalancingPeriod = baskets[_basketId].lastRebalancingPeriod;

    if (currentRebalancingPeriod <= lastRebalancingPeriod) return;

    for (uint k = 0; k < chainIds.length; k++) {
      uint32 chain = chainIds[k];
      uint256 latestProtocol = latestProtocolId[chain];
      for (uint i = 0; i < latestProtocol; i++) {
        int256 allocation = basketAllocationInProtocol(_basketId, chain, i) / 1E18;
        if (allocation == 0) continue;

        int256 lastRebalanceReward = getRewardsPerLockedToken(
          vaultNum,
          chain,
          lastRebalancingPeriod,
          i
        );
        int256 currentReward = getRewardsPerLockedToken(
          vaultNum,
          chain,
          currentRebalancingPeriod,
          i
        );
        baskets[_basketId].totalUnRedeemedRewards +=
          (currentReward - lastRebalanceReward) *
          allocation;
      }
    }
  }

  /// @notice Internal helper to lock or unlock tokens from the game contract
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract
  /// @param _totalDelta total delta allocated tokens of the basket, calculated in settleDeltaAllocations
  function lockOrUnlockTokens(uint256 _basketId, int256 _totalDelta) internal {
    if (_totalDelta > 0) {
      lockTokensToBasket(uint256(_totalDelta));
    }
    if (_totalDelta < 0) {
      int256 oldTotal = basketTotalAllocatedTokens(_basketId);
      int256 newTotal = oldTotal + _totalDelta;
      int256 tokensToUnlock = oldTotal - newTotal;
      require(oldTotal >= tokensToUnlock, "Not enough tokens locked");

      unlockTokensFromBasket(_basketId, uint256(tokensToUnlock));
    }
  }

  /// @notice Step 1 trigger; Game pushes totalDeltaAllocations to xChainController
  /// @notice Trigger for Dao to push delta allocations to the xChainController
  /// @param _vaultNumber Number of vault
  /// @dev Sends over an array that should match the IDs in chainIds array
  function pushAllocationsToController(uint256 _vaultNumber) external payable {
    require(rebalanceNeeded(), "No rebalance needed");
    for (uint k = 0; k < chainIds.length; k++) {
      require(
        getVaultAddress(_vaultNumber, chainIds[k]) != address(0),
        "Game: not a valid vaultnumber"
      );
      require(
        !isXChainRebalancing[_vaultNumber][chainIds[k]],
        "Game: vault is already rebalancing"
      );
      isXChainRebalancing[_vaultNumber][chainIds[k]] = true;
    }

    int256[] memory deltas = allocationsToArray(_vaultNumber);
    IXProvider(xProvider).pushAllocations{value: msg.value}(_vaultNumber, deltas);

    lastTimeStamp = block.timestamp;
    vaults[_vaultNumber].rebalancingPeriod++;

    emit PushedAllocationsToController(_vaultNumber, deltas);
  }

  /// @notice Creates delta allocation array for chains matching IDs in chainIds array
  /// @notice Resets deltaAllocation for chainIds
  /// @return deltas Array with delta Allocations for all chainIds
  function allocationsToArray(uint256 _vaultNumber) internal returns (int256[] memory deltas) {
    deltas = new int[](chainIds.length);

    for (uint256 i = 0; i < chainIds.length; i++) {
      uint32 chain = chainIds[i];
      deltas[i] = getDeltaAllocationChain(_vaultNumber, chain);
      vaults[_vaultNumber].deltaAllocationChain[chain] = 0;
    }
  }

  /// @notice Step 6 trigger; Game pushes deltaAllocations to vaults
  /// @notice Trigger to push delta allocations in protocols to cross chain vaults
  /// @param _vaultNumber Number of vault
  /// @param _chain Chain id of the vault where the allocations need to be sent
  /// @dev Sends over an array where the index is the protocolId
  function pushAllocationsToVaults(uint256 _vaultNumber, uint32 _chain) external payable {
    address vault = getVaultAddress(_vaultNumber, _chain);
    require(vault != address(0), "Game: not a valid vaultnumber");
    require(isXChainRebalancing[_vaultNumber][_chain], "Vault is not rebalancing");

    int256[] memory deltas = protocolAllocationsToArray(_vaultNumber, _chain);

    IXProvider(xProvider).pushProtocolAllocationsToVault{value: msg.value}(_chain, vault, deltas);

    emit PushProtocolAllocations(_chain, getVaultAddress(_vaultNumber, _chain), deltas);

    isXChainRebalancing[_vaultNumber][_chain] = false;
  }

  /// @notice Creates array with delta allocations in protocols for given chainId
  /// @return deltas Array with allocations where the index matches the protocolId
  function protocolAllocationsToArray(
    uint256 _vaultNumber,
    uint32 _chainId
  ) internal returns (int256[] memory deltas) {
    uint256 latestId = latestProtocolId[_chainId];
    deltas = new int[](latestId);

    for (uint256 i = 0; i < latestId; i++) {
      deltas[i] = getDeltaAllocationProtocol(_vaultNumber, _chainId, i);
      vaults[_vaultNumber].deltaAllocationProtocol[_chainId][i] = 0;
    }
  }

  /// @notice See settleRewardsInt below
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Rewards per locked token per protocol (each protocol is an element in the array)
  function settleRewards(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlyXProvider {
    settleRewardsInt(_vaultNumber, _chainId, _rewards);
  }

  // basket should not be able to rebalance before this step
  /// @notice Step 8 end; Vaults push rewardsPerLockedToken to game
  /// @notice Loops through the array and fills the rewardsPerLockedToken mapping with the values
  /// @param _vaultNumber Number of the vault
  /// @param _chainId Number of chain used
  /// @param _rewards Array with rewardsPerLockedToken of all protocols in vault => index matches protocolId
  function settleRewardsInt(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) internal {
    uint256 rebalancingPeriod = vaults[_vaultNumber].rebalancingPeriod;

    for (uint256 i = 0; i < _rewards.length; i++) {
      int256 lastReward = getRewardsPerLockedToken(
        _vaultNumber,
        _chainId,
        rebalancingPeriod - 1,
        i
      );
      vaults[_vaultNumber].rewardPerLockedToken[_chainId][rebalancingPeriod][i] =
        lastReward +
        _rewards[i];
    }
  }

  /// @notice Getter for rewardsPerLockedToken for given vaultNumber => chainId => rebalancingPeriod => protocolId
  function getRewardsPerLockedToken(
    uint256 _vaultNumber,
    uint32 _chainId,
    uint256 _rebalancingPeriod,
    uint256 _protocolId
  ) internal view returns (int256) {
    return vaults[_vaultNumber].rewardPerLockedToken[_chainId][_rebalancingPeriod][_protocolId];
  }

  /// @notice redeem funds from basket in the game.
  /// @dev makes a call to the vault to make the actual transfer because the vault holds the funds.
  /// @param _basketId Basket ID (tokenID) in the BasketToken (NFT) contract.
  function redeemRewards(uint256 _basketId) external onlyBasketOwner(_basketId) {
    int256 amount = baskets[_basketId].totalUnRedeemedRewards;
    require(amount > 0, "Nothing to claim");

    baskets[_basketId].totalRedeemedRewards += amount;
    baskets[_basketId].totalUnRedeemedRewards = 0;

    IVault(homeVault).redeemRewardsGame(uint256(amount), msg.sender);
  }

  /// @notice Checks if a rebalance is needed based on the set interval
  /// @return bool True of rebalance is needed, false if not
  function rebalanceNeeded() public view returns (bool) {
    return (block.timestamp - lastTimeStamp) > rebalanceInterval || msg.sender == guardian;
  }

  /// @notice getter for vault address linked to a chainId
  function getVaultAddress(uint256 _vaultNumber, uint32 _chainId) internal view returns (address) {
    return vaults[_vaultNumber].vaultAddress[_chainId];
  }

  /// @notice Getter for dao address
  function getDao() public view returns (address) {
    return dao;
  }

  /// @notice Getter for guardian address
  function getGuardian() public view returns (address) {
    return guardian;
  }

  /// @notice Getter for chainId array
  function getChainIds() public view returns (uint32[] memory) {
    return chainIds;
  }

  /// @notice Getter for rebalancing period for a vault
  function getRebalancingPeriod(uint256 _vaultNumber) public view returns (uint256) {
    return vaults[_vaultNumber].rebalancingPeriod;
  }

  /*
  Only Dao functions
  */

  /// @notice Setter for xProvider address
  /// @param _xProvider new address of xProvider on this chain
  function setXProvider(address _xProvider) external onlyDao {
    xProvider = _xProvider;
  }

  /// @notice Setter for homeVault address
  /// @param _homeVault new address of homeVault on this chain
  function setHomeVault(address _homeVault) external onlyDao {
    homeVault = _homeVault;
  }

  /// @notice Set minimum interval for the rebalance function
  /// @param _timestampInternal UNIX timestamp
  function setRebalanceInterval(uint256 _timestampInternal) external onlyDao {
    rebalanceInterval = _timestampInternal;
  }

  /// @notice Setter for DAO address
  /// @param _dao DAO address
  function setDao(address _dao) external onlyDao {
    dao = _dao;
  }

  /// @notice Setter for guardian address
  /// @param _guardian new address of the guardian
  function setGuardian(address _guardian) external onlyDao {
    guardian = _guardian;
  }

  /// @notice Setter Derby token address
  /// @param _derbyToken new address of Derby token
  function setDerbyToken(address _derbyToken) external onlyDao {
    derbyToken = IERC20(_derbyToken);
  }

  /// @notice Setter for threshold at which user tokens will be sold / burned
  /// @param _threshold treshold in vaultCurrency e.g USDC, must be negative
  function setNegativeRewardThreshold(int256 _threshold) external onlyDao {
    negativeRewardThreshold = _threshold;
  }

  /// @notice Setter for negativeRewardFactor
  /// @param _factor percentage of tokens that will be sold / burned
  function setNegativeRewardFactor(uint256 _factor) external onlyDao {
    negativeRewardFactor = _factor;
  }

  /*
  Only Guardian functions
  */

  /// @notice setter to link a chainId to a vault address for cross chain functions
  function setVaultAddress(
    uint256 _vaultNumber,
    uint32 _chainId,
    address _address
  ) external onlyGuardian {
    vaults[_vaultNumber].vaultAddress[_chainId] = _address;
  }

  /// @notice Setter for latest protocol Id for given chainId.
  /// @param _chainId number of chain id set in chainIds array
  /// @param _latestProtocolId latest protocol Id aka number of supported protocol vaults, starts at 0
  function setLatestProtocolId(uint32 _chainId, uint256 _latestProtocolId) external onlyGuardian {
    latestProtocolId[_chainId] = _latestProtocolId;
  }

  /// @notice Setter for chainId array
  /// @param _chainIds array of all the used chainIds
  function setChainIds(uint32[] memory _chainIds) external onlyGuardian {
    chainIds = _chainIds;
  }

  /// @notice Guardian function to set state when vault gets stuck for whatever reason
  function setRebalancingState(
    uint256 _vaultNumber,
    uint32 _chain,
    bool _state
  ) external onlyGuardian {
    isXChainRebalancing[_vaultNumber][_chain] = _state;
  }

  /// @notice Guardian function to set rebalancing period for vaultNumber
  function setRebalancingPeriod(uint256 _vaultNumber, uint256 _period) external onlyGuardian {
    vaults[_vaultNumber].rebalancingPeriod = _period;
  }

  /// @notice Step 8: Guardian function
  function settleRewardsGuard(
    uint256 _vaultNumber,
    uint32 _chainId,
    int256[] memory _rewards
  ) external onlyGuardian {
    settleRewardsInt(_vaultNumber, _chainId, _rewards);
  }
}
