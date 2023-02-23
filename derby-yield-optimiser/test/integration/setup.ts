import hre from 'hardhat';
import { erc20, parseDRB, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, XChainControllerMock } from '@typechain';
import { dai, usdc, usdt, yearn } from '@testhelp/addresses';
import {
  getAndInitXProviders,
  AddAllVaultsToController as addVaultsToController,
  InitConnextMock,
  setGameLatestProtocolIds,
  addVaultsToXController,
  setWhitelistVaults,
} from '@testhelp/InitialiseContracts';
import { deployYearnMockVaults, getContract, getTestVaults } from '@testhelp/getContracts';
import allProvidersClass from '@testhelp/classes/allProvidersClass';
import { allNamedAccountsToSigners } from './helpers';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';

const chainids = [10, 100];

export const setupIntegration = async () => {
  const { run, deployments } = hre;
  await deployments.fixture([
    'XChainControllerMock',
    'YearnProvider',
    'CompoundProvider',
    'AaveProvider',
    'TruefiProvider',
    'IdleProvider',
    'BetaProvider',
    'TestVault1',
    'TestVault2',
    'TestVault3',
    'TestVault4',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
    'XProviderBnb',
    'YearnMockUSDC1',
    'YearnMockUSDC2',
    'YearnMockDAI1',
    'YearnMockDAI2',
    'YearnMockUSDT1',
  ]);

  const IUSDc = erc20(usdc);
  const [dao, guardian, user, user1, user2, gameUser0, gameUser1] = await allNamedAccountsToSigners(
    hre,
  );
  const vaultNumber = 10;

  const game = (await getContract('GameMock', hre)) as GameMock;
  const controller = (await getContract('Controller', hre)) as Controller;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;

  const underlyingVaults = await deployYearnMockVaults(hre);
  const [yearn1, yearn2, yearn3, yearn4, yearn5] = underlyingVaults;

  const [vault1, vault2] = await getTestVaults(hre);
  const vaults = [vault1, vault2];
  const users = [user, user1, user2];
  const gameUsers = [gameUser0, gameUser1];
  const allXProviders = await getAndInitXProviders(hre, dao, { xController: 100, game: 10 });
  const [xProviderMain, xProviderArbi] = allXProviders;

  await Promise.all([
    run('controller_init'),

    run('game_init', { provider: xProviderMain.address, homevault: vault1.address, chainids }),

    run('vault_init', { contract: 'TestVault1' }),
    run('vault_init', { contract: 'TestVault2' }),

    run('vault_set_homexprovider', { contract: 'TestVault1', address: xProviderMain.address }),
    run('vault_set_homexprovider', { contract: 'TestVault2', address: xProviderArbi.address }),

    run('xcontroller_init', { chainids, homexprovider: xProviderArbi.address }),
  ]);

  await Promise.all([
    setWhitelistVaults(hre, allXProviders, dao),
    InitConnextMock(hre, allXProviders),
    addVaultsToController(hre),
    addVaultsToXController(hre, xChainController, dao, vaultNumber),
    setGameLatestProtocolIds(hre, { vaultNumber, latestId: 5, chainids }),

    IUSDc.connect(user).approve(vault1.address, 100_000 * 1e6),
    IUSDc.connect(user).approve(vault2.address, 200_000 * 1e6),

    derbyToken.transfer(gameUser0.address, parseDRB(10_000)),
    derbyToken.transfer(gameUser1.address, parseDRB(10_000)),

    transferAndApproveUSDC(vault1.address, user, 10_000_000 * 1e6),
    transferAndApproveUSDC(vault1.address, user1, 10_000_000 * 1e6),
    transferAndApproveUSDC(vault2.address, user2, 10_000_000 * 1e6),

    allProvidersClass.setProviders(hre),
    vault1.connect(dao).setSwapRewards(false),
  ]);

  // Adding mock yearn vaults
  const yearn_vault_usdc1 = new ProtocolVault({
    name: 'yearn_mock_usdc1',
    protocolToken: yearn1.address,
    underlyingToken: usdc,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });
  const yearn_vault_usdc2 = new ProtocolVault({
    name: 'yearn_mock_usdc2',
    protocolToken: yearn2.address,
    underlyingToken: usdc,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });
  const yearn_vault_dai1 = new ProtocolVault({
    name: 'yearn_mock_dai1',
    protocolToken: yearn3.address,
    underlyingToken: dai,
    govToken: yearn,
    decimals: 18,
    chainId: 1,
  });
  const yearn_vault_dai2 = new ProtocolVault({
    name: 'yearn_mock_dai2',
    protocolToken: yearn4.address,
    underlyingToken: dai,
    govToken: yearn,
    decimals: 18,
    chainId: 1,
  });
  const yearn_vault_usdt = new ProtocolVault({
    name: 'yearn_mock_usdt1',
    protocolToken: yearn5.address,
    underlyingToken: usdt,
    govToken: yearn,
    decimals: 6,
    chainId: 1,
  });

  await Promise.all([
    yearn_vault_usdc1.addProtocolToController(controller, dao, vaultNumber, allProvidersClass),
    yearn_vault_usdc2.addProtocolToController(controller, dao, vaultNumber, allProvidersClass),
    yearn_vault_dai1.addProtocolToController(controller, dao, vaultNumber, allProvidersClass),
    yearn_vault_dai2.addProtocolToController(controller, dao, vaultNumber, allProvidersClass),
    yearn_vault_usdt.addProtocolToController(controller, dao, vaultNumber, allProvidersClass),
  ]);

  return {
    vaults,
    underlyingVaults,
    controller,
    game,
    xChainController,
    derbyToken,
    dao,
    users,
    gameUsers,
    guardian,
  };
};
