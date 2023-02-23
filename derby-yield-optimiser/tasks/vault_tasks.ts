import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getInitConfigVault } from '@testhelp/deployHelpers';

task('vault_init', 'Initializes the vault')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const { getNamedAccounts, run, network } = hre;
    const { guardian } = await getNamedAccounts();
    const initConfig = await getInitConfigVault(contract, network.name);
    if (!initConfig) throw 'Unknown contract name';

    const { rebalanceInterval, marginScale, liquidityPercentage, performanceFee, homeChain } =
      initConfig;

    await run('vault_set_guardian', { contract, guardian: guardian });
    await run('vault_set_rebalance_interval', { contract, timestamp: rebalanceInterval });
    await run('vault_set_margin_scale', { contract, scale: marginScale });
    await run('vault_set_liquidity_perc', { contract, percentage: liquidityPercentage });
    await run('vault_set_performance_fee', { contract, percentage: performanceFee });
    await run('vault_set_swap_rewards', { contract, state: true });
    await run('vault_set_home_chain', { contract, chainid: homeChain });
  });

/*************
CrossChain
**************/
// not tested yet
task(
  'vault_push_total_underlying',
  'Step 2: Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests',
)
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.pushTotalUnderlyingToController();
  });
// not tested yet
task('vault_rebalance_xchain', 'Step 4; Push funds from vaults to xChainController')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.rebalanceXChain();
  });
// not tested yet
task('vault_send_rewards_game', 'Step 8; Vaults push rewardsPerLockedToken to game')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.sendRewardsToGame();
  });
// not tested yet
task('vault_rebalance_vault', 'Step 7 trigger, end; Vaults rebalance')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.rebalanceETF();
  });
// not tested yet
task('vault_set_totalunderlying', 'Set total balance in VaultCurrency in all underlying protocols')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.setTotalUnderlying();
  });
// not tested yet
task('vault_claim_tokens', 'Harvest extra tokens from underlying protocols')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    await vault.claimTokens();
  });

/*************
onlyGuardian
**************/
// Not tested yet
task('vault_set_xchain_allocation', 'Step 3: Guardian function')
  .addParam('contract', 'Name of the contract')
  .addParam('amount', 'XChain amount to send back', null, types.int)
  .addParam('exchangerate', 'new exchangerate for vault', null, types.int)
  .setAction(async ({ amount, exchangerate, contract }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setXChainAllocationGuard(amount, exchangerate);
  });
// Not tested yet
task('vault_receive_funds', 'Step 5: Guardian function')
  .addParam('contract', 'Name of the contract')
  .setAction(async ({ contract }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).receiveFundsGuard();
  });
// Not tested yet
task('vault_receive_protocol_allocations', 'Step 6: Guardian function')
  .addParam('contract', 'Name of the contract')
  .addVariadicPositionalParam('deltas', 'Number of chain id set in chainIds array', [], types.int)
  .setAction(async ({ contract, deltas }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).receiveProtocolAllocationsGuard(deltas);
  });

task('vault_set_state', 'Guardian function to set state when vault gets stuck')
  .addParam('contract', 'Name of the contract')
  .addParam('state', 'state of the vault', null, types.int)
  .setAction(async ({ contract, state }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setVaultStateGuard(state);
  });

task('vault_set_home_chain', 'Setter for new homeChain Id')
  .addParam('contract', 'Name of the contract')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ contract, chainid }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setHomeChain(chainid);
  });

task('vault_set_rebalance_interval', 'Set minimum interval for the rebalance function')
  .addParam('contract', 'Name of the contract')
  .addParam('timestamp', 'UNIX timestamp', null, types.int)
  .setAction(async ({ contract, timestamp }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setRebalanceInterval(timestamp);
  });

task('vault_blacklist_protocol', 'Blacklist a protolNumber')
  .addParam('contract', 'Name of the contract')
  .addParam('protocol', 'Protocol number', null, types.int)
  .setAction(async ({ contract, protocol }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).blacklistProtocol(protocol);
  });

task('vault_set_margin_scale', 'Set the marginScale')
  .addParam('contract', 'Name of the contract')
  .addParam('scale', 'New margin scale', null, types.int)
  .setAction(async ({ contract, scale }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setMarginScale(scale);
  });

task(
  'vault_set_liquidity_perc',
  'Amount of liquidity which should be held in the vault after rebalancing',
)
  .addParam('contract', 'Name of the contract')
  .addParam('percentage', 'New margin scale', null, types.int)
  .setAction(async ({ contract, percentage }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setLiquidityPerc(percentage);
  });

task('vault_set_governance_fee', 'Fee in basis points')
  .addParam('contract', 'Name of the contract')
  .addParam('fee', 'New governance fee', null, types.int)
  .setAction(async ({ contract, fee }, hre) => {
    const vault = await getVault(hre, contract);
    const guardian = await getGuardian(hre);
    await vault.connect(guardian).setGovernanceFee(fee);
  });

/*************
OnlyDao
**************/

task('vault_set_homexprovider', 'Setter for xProvider address')
  .addParam('contract', 'Name of the contract')
  .addParam('address', 'New provider address')
  .setAction(async ({ contract, address }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setHomeXProvider(address);
  });

task('vault_set_dao_token', 'Setter for derby token address')
  .addParam('contract', 'Name of the contract')
  .addParam('address', 'New token address')
  .setAction(async ({ contract, address }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setDaoToken(address);
  });

task('vault_set_game', 'Setter for game address')
  .addParam('contract', 'Name of the contract')
  .addParam('address', 'New game address')
  .setAction(async ({ contract, address }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setGame(address);
  });

task('vault_set_swap_rewards', 'Setter for swapping rewards to derby tokens')
  .addParam('contract', 'Name of the contract')
  .addParam('state', 'True when rewards should be swapped to derby tokens', null, types.boolean)
  .setAction(async ({ contract, state }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setSwapRewards(state);
  });

task('vault_set_dao', 'Setter for dao address')
  .addParam('contract', 'Name of the contract')
  .addParam('address', 'New dao address')
  .setAction(async ({ contract, address }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setDao(address);
  });

task('vault_set_guardian', 'Setter for guardian address')
  .addParam('contract', 'Name of the contract')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ contract, guardian }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setGuardian(guardian);
  });

task('vault_set_performance_fee', 'Setter for performance fee that goes to players')
  .addParam('contract', 'Name of the contract')
  .addParam('percentage', 'percentage of the yield that goes to the game players', null, types.int)
  .setAction(async ({ contract, percentage }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setPerformanceFee(percentage);
  });

task('vault_set_max_divergence', 'Setter for maximum divergence a user can get during a withdraw')
  .addParam('contract', 'Name of the contract')
  .addParam('divergence', 'New maximum divergence in vaultCurrency', null, types.int)
  .setAction(async ({ contract, divergence }, hre) => {
    const vault = await getVault(hre, contract);
    const dao = await getDao(hre);
    await vault.connect(dao).setMaxDivergence(divergence);
  });

const getVault = async (
  { deployments, ethers, network }: HardhatRuntimeEnvironment,
  contract: string,
) => {
  const vaultContract = network.name === 'hardhat' ? 'MainVaultMock' : 'MainVault';
  const { address } = await deployments.get(contract);
  const vault = await ethers.getContractAt(vaultContract, address);
  return vault;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};

const getGuardian = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { guardian } = await getNamedAccounts();
  return ethers.getSigner(guardian);
};
