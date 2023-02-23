import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('xcontroller_init', 'Initializes the xController')
  .addVariadicPositionalParam('chainids', 'array of chainids', [], types.int)
  .addParam('homexprovider', 'Number of vault')
  .setAction(async ({ homexprovider, chainids }, { run }) => {
    await run('xcontroller_set_chain_ids', { chainids });
    await run('xcontroller_set_homexprovider', { address: homexprovider });
  });

/*************
CrossChain
**************/
// not tested yet
task(
  'xcontroller_push_vault_amounts',
  'Step 3; xChainController pushes exchangeRate and amount the vaults',
)
  .addParam('vaultnumber', 'Number of vault')
  .setAction(async ({ vaultnumber }, hre) => {
    const xcontroller = await getXController(hre);
    await xcontroller.pushVaultAmounts(vaultnumber);
  });
// not tested yet
task('xcontroller_send_funds_vault', 'Step 5; Push funds from xChainController to vaults')
  .addParam('vaultnumber', 'Number of vault')
  .setAction(async ({ vaultnumber }, hre) => {
    const xcontroller = await getXController(hre);
    await xcontroller.sendFundsToVault(vaultnumber);
  });

/*************
Only Guardian
**************/

task('xcontroller_set_chain_ids', 'Setter for chainId array')
  .addVariadicPositionalParam('chainids', 'Number of chain id set in chainIds array', [], types.int)
  .setAction(async ({ chainids }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).setChainIds(chainids);
  });

task('xcontroller_reset_vault_stages', 'Resets all stages in vaultStage struct for a vaultNumber')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .setAction(async ({ vaultnumber }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).resetVaultStagesDao(vaultnumber);
  });

task('xcontroller_receive_allocations', 'Receive allocations from game manually')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addVariadicPositionalParam('deltas', 'Delta allocations array', [], types.int)
  .setAction(async ({ vaultnumber, deltas }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).receiveAllocationsFromGameGuard(vaultnumber, deltas);
  });

task('xcontroller_set_totalunderlying', 'Step 2: Guardian')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addParam('chainid', 'Number of chainid', null, types.int)
  .addParam('underlying', 'totalUnderlung plus vault balance', null, types.int)
  .addParam('totalsupply', 'Supply of the LP token of the vault', null, types.int)
  .addParam('withdrawalrequests', 'Total amount of withdrawal requests', null, types.int)
  .setAction(async ({ vaultnumber, chainid, underlying, totalsupply, withdrawalrequests }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller
      .connect(guardian)
      .setTotalUnderlyingGuard(vaultnumber, chainid, underlying, totalsupply, withdrawalrequests);
  });

task('xcontroller_set_active_vaults', 'Guardian setter for number of active vaults')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addParam('activevaults', 'Number of active vault', null, types.int)
  .setAction(async ({ vaultnumber, activevaults }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).setActiveVaultsGuard(vaultnumber, activevaults);
  });

task('xcontroller_set_ready', 'Guardian setter for stage 0')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addParam('state', 'If vault is ready', null, types.boolean)
  .setAction(async ({ vaultnumber, state }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).setReadyGuard(vaultnumber, state);
  });

task('xcontroller_set_allocations_received', 'Guardian setter for stage 1')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addParam('state', 'If allocations received', null, types.boolean)
  .setAction(async ({ vaultnumber, state }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).setAllocationsReceivedGuard(vaultnumber, state);
  });

task('xcontroller_set_underlying_received', 'Guardian setter for number of active vaults')
  .addParam('vaultnumber', 'Number of vault', null, types.int)
  .addParam('received', 'Number of underlyings received', null, types.int)
  .setAction(async ({ vaultnumber, received }, hre) => {
    const xcontroller = await getXController(hre);
    const guardian = await getGuardian(hre);
    await xcontroller.connect(guardian).setUnderlyingReceivedGuard(vaultnumber, received);
  });

/*************
Only Dao
**************/

task('xcontroller_set_vault_chain_address', 'Set Vault address and underlying for a chainId')
  .addParam('vaultnumber', 'Number of the vault', null, types.int)
  .addParam('chainid', 'Number of chain used', null, types.int)
  .addParam('address', 'Address of the Vault')
  .addParam('underlying', 'Underlying of the Vault eg USDC')
  .setAction(async ({ vaultnumber, chainid, address, underlying }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setVaultChainAddress(vaultnumber, chainid, address, underlying);
  });

task('xcontroller_set_homexprovider', 'Setter for xProvider address')
  .addParam('address', 'New provider address')
  .setAction(async ({ address }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setHomeXProvider(address);
  });

task('xcontroller_set_home_chain', 'Setter for new homeChain Id')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setHomeChainId(chainid);
  });

task('xcontroller_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setDao(address);
  });

task('xcontroller_set_guardian', 'Setter for guardian address')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ guardian }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);
    await xcontroller.connect(dao).setGuardian(guardian);
  });

task('xcontroller_set_game', 'Setter for game address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);

    await xcontroller.connect(dao).setGame(address);
  });

task('xcontroller_set_minimum_amount', 'Setter for minimum amount to send xChain')
  .addParam('amount', 'New minimum amount', null, types.int)
  .setAction(async ({ amount }, hre) => {
    const xcontroller = await getXController(hre);
    const dao = await getDao(hre);

    await xcontroller.connect(dao).setMinimumAmount(amount);
  });

const getXController = async ({ deployments, ethers, network }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const xControllerContract =
    network.name === 'hardhat' ? 'XChainControllerMock' : 'XChainController';
  const { address } = await deployments.get(xControllerContract);
  const vault = await ethers.getContractAt(xControllerContract, address);
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
