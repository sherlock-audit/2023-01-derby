import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

task('xprovider_init', 'Set trusted provider on remote chains')
  .addParam('provider', 'Address of the XController provider', null, types.int)
  .addParam('chainid', 'chainId of the xController')
  .addParam('gamechain', 'chainId of the game')
  .setAction(async ({ provider, chainid, gamechain }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXControllerProvider(provider);
    await xProvider.connect(dao).setXControllerChainId(chainid);
    await xProvider.connect(dao).setGameChainId(gamechain);
  });

/*************
  Only Dao
**************/
  task('xprovider_set_trusted_connext', 'Set trusted provider on remote chains')
  .addParam('chainid', 'Chain is for remote xprovider', null, types.int)
  .addParam('address', 'Address of remote xprovider')
  .setAction(async ({ chainid, address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setTrustedRemoteConnext(chainid, address);
  });

task('xprovider_set_xcontroller', 'Setter for xController address')
  .addParam('address', 'New xController address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXController(address);
  });

task('xprovider_set_xcontroller_provider', 'Setter for xControllerProvider address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXControllerProvider(address);
  });

task('xprovider_set_xcontroller_chain', 'Setter for xController chain id')
  .addParam('chainid', 'new xController chain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setXControllerChainId(chainid);
  });

task('xprovider_set_home_chain', 'Setter for new homeChain Id')
  .addParam('chainid', 'new homeChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setHomeChain(chainid);
  });

task('xprovider_set_game_chain', 'Setter for gameChain Id')
  .addParam('chainid', 'new gameChain id', null, types.int)
  .setAction(async ({ chainid }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setGameChainId(chainid);
  });

task('xprovider_vault_whitelist', 'Whitelists vault address for onlyVault modifier')
  .addParam('address', 'Vault address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).toggleVaultWhitelist(address);
  });

task('xprovider_set_game', 'Setter for game address')
  .addParam('address', 'New game address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setGame(address);
  });

task('xprovider_set_dao', 'Setter for dao address')
  .addParam('address', 'New dao address')
  .setAction(async ({ address }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setDao(address);
  });

task('xprovider_set_guardian', 'Setter for guardian address')
  .addParam('guardian', 'New guardian address')
  .setAction(async ({ guardian }, hre) => {
    const xProvider = await getXProvider(hre);
    const dao = await getDao(hre);
    await xProvider.connect(dao).setGuardian(guardian);
  });

const getXProvider = async ({ deployments, ethers }: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const { address } = await deployments.get('XProvider');
  const vault = await ethers.getContractAt('XProvider', address);
  return vault;
};

const getDao = async ({ ethers, getNamedAccounts }: HardhatRuntimeEnvironment) => {
  const { dao } = await getNamedAccounts();
  return ethers.getSigner(dao);
};
