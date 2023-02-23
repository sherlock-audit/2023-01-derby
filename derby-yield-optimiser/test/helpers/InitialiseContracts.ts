import { XChainController, XProvider, ConnextMock } from '@typechain';
import { BigNumberish, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { usdc } from './addresses';
import { getTestVaultDeployments, getContract } from './getContracts';

export async function getAndInitXProviders(
  hre: HardhatRuntimeEnvironment,
  dao: Signer,
  chains: {
    xController: number;
    game: number;
  },
): Promise<XProvider[]> {
  const { deployments, ethers } = hre;

  const [main, arbitrum, optimism, bnb] = await Promise.all([
    deployments.get('XProviderMain'),
    deployments.get('XProviderArbi'),
    deployments.get('XProviderOpti'),
    deployments.get('XProviderBnb'),
  ]);

  const xProviders = await Promise.all([
    ethers.getContractAt('XProvider', main.address),
    ethers.getContractAt('XProvider', arbitrum.address),
    ethers.getContractAt('XProvider', optimism.address),
    ethers.getContractAt('XProvider', bnb.address),
  ]);

  for (const xProvider of xProviders) {
    await Promise.all([
      xProvider.connect(dao).setXControllerProvider(arbitrum.address),
      xProvider.connect(dao).setXControllerChainId(chains.xController),
      xProvider.connect(dao).setGameChainId(chains.game),
      xProvider.connect(dao).setTrustedRemoteConnext(10, main.address),
      xProvider.connect(dao).setTrustedRemoteConnext(100, arbitrum.address),
      xProvider.connect(dao).setTrustedRemoteConnext(1000, optimism.address),
      xProvider.connect(dao).setTrustedRemoteConnext(10000, bnb.address),
    ]);
  }

  return [...xProviders];
}

export async function setWhitelistVaults(
  { deployments }: HardhatRuntimeEnvironment,
  allXProviders: XProvider[],
  dao: Signer,
) {
  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = allXProviders;
  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  await Promise.all([
    xProviderMain.connect(dao).toggleVaultWhitelist(vault1.address),
    xProviderArbi.connect(dao).toggleVaultWhitelist(vault2.address),
    xProviderOpti.connect(dao).toggleVaultWhitelist(vault3.address),
    xProviderBnb.connect(dao).toggleVaultWhitelist(vault4.address),
  ]);
}

export async function addVaultsToXController(
  { deployments }: HardhatRuntimeEnvironment,
  xController: XChainController,
  dao: Signer,
  vaultNumber: number | BigNumberish,
) {
  const [vault1, vault2, vault3, vault4] = await getTestVaultDeployments(deployments);

  await Promise.all([
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10, vault1.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 100, vault2.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 1000, vault3.address, usdc),
    xController.connect(dao).setVaultChainAddress(vaultNumber, 10000, vault4.address, usdc),
  ]);
}

export async function setGameLatestProtocolIds(
  { run, deployments }: HardhatRuntimeEnvironment,
  info: {
    vaultNumber: number;
    latestId: number;
    chainids: BigNumberish[];
  },
) {
  const { vaultNumber, chainids, latestId } = info;

  const vaults = await getTestVaultDeployments(deployments);

  for (let i = 0; i < chainids.length; i++) {
    await run('game_latest_protocol_id', { chainid: chainids[i], latestprotocolid: latestId });
    await run('game_set_vault_address', {
      vaultnumber: vaultNumber,
      chainid: chainids[i],
      address: vaults[i].address,
    });
  }
}

export async function InitConnextMock(hre: HardhatRuntimeEnvironment, xProviders: XProvider[]) {
  const connext = (await getContract('ConnextMock', hre)) as ConnextMock;
  const [xProviderMain, xProviderArbi, xProviderOpti, xProviderBnb] = xProviders;

  await Promise.all([
    connext.setDomainLookup(xProviderMain.address, 10),
    connext.setDomainLookup(xProviderArbi.address, 100),
    connext.setDomainLookup(xProviderOpti.address, 1000),
    connext.setDomainLookup(xProviderBnb.address, 10000),
  ]);
}

export async function AddAllVaultsToController({ run, deployments }: HardhatRuntimeEnvironment) {
  const vaults = await getTestVaultDeployments(deployments);

  for (const vault of vaults) {
    await run('controller_add_vault', { vault: vault.address });
  }
}
