import { deployments, run } from 'hardhat';
import { parseEther, transferAndApproveUSDC } from '@testhelp/helpers';
import type { GameMock, MainVaultMock, DerbyToken, XChainControllerMock } from '@typechain';

import {
  getAndInitXProviders,
  InitConnextMock,
  setGameLatestProtocolIds,
} from '@testhelp/InitialiseContracts';
import { getAllSigners, getContract } from '@testhelp/getContracts';

export const setupGame = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'XChainControllerMock',
    'TestVault1',
    'TestVault2',
    'TestVault3',
    'TestVault4',
    'XProviderMain',
    'XProviderArbi',
    'XProviderOpti',
    'XProviderBnb',
  ]);

  const contract = 'TestVault1';
  const game = (await getContract('GameMock', hre)) as GameMock;
  const derbyToken = (await getContract('DerbyToken', hre)) as DerbyToken;
  const xChainController = (await getContract('XChainControllerMock', hre)) as XChainControllerMock;
  const vault = (await getContract(contract, hre, 'MainVaultMock')) as MainVaultMock;

  const [dao, user, guardian] = await getAllSigners(hre);
  const userAddr = await user.getAddress();
  const vaultNumber = 10;
  const chainids = [10, 100, 1000];

  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = await getAndInitXProviders(
    hre,
    dao,
    {
      xController: 100,
      game: 10,
    },
  );
  await InitConnextMock(hre, [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb]);

  const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });
  await run('game_init', {
    provider: xProviderMain.address,
    homevault: vault.address,
    chainids,
  });
  await run('xcontroller_init', { chainids, homexprovider: xProviderArbi.address });
  await run('xcontroller_set_homexprovider', { address: xProviderArbi.address });
  await run('vault_init', { contract });
  await run('vault_set_liquidity_perc', { contract, percentage: 10 });
  await run('controller_init');

  await derbyToken.transfer(userAddr, parseEther('2100'));
  await transferAndApproveUSDC(vault.address, user, 100_000_000 * 1e6);
  await setGameLatestProtocolIds(hre, { vaultNumber, latestId: 5, chainids: chainids });

  return { game, derbyToken, vault, dao, user, userAddr, vaultNumber, basketId, xChainController };
});
