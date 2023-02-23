import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { XProvider } from '@typechain';
import { DeploymentsExtension } from 'hardhat-deploy/types';
import { HardhatEthersHelpers } from 'hardhat/types';

describe('Testing xProvider tasks', () => {
  const setupXProvider = deployments.createFixture(async ({ ethers, deployments }) => {
    const xProvider = await deployXProvider(deployments, ethers);

    return { xProvider };
  });

  /*************
  Only Dao
  **************/

  it('xprovider_set_trusted_connext', async function () {
    const { xProvider } = await setupXProvider();
    const chainId = random(10_000);
    const address = '0xa354f35829ae975e850e23e9615b11da1b3dc4de';

    await run('xprovider_set_trusted_connext', { chainid: chainId, address });
    expect(await (await xProvider.trustedRemoteConnext(chainId)).toLowerCase()).to.be.equal(
      address.toLowerCase(),
    );
  });

  it('xprovider_set_xcontroller', async function () {
    const { xProvider } = await setupXProvider();
    const address = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('xprovider_set_xcontroller', { address });
    expect(await xProvider.xController()).to.be.equal(address);
  });

  it('xprovider_set_xcontroller_provider', async function () {
    const { xProvider } = await setupXProvider();
    const address = '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9';

    await run('xprovider_set_xcontroller_provider', { address });
    expect(await xProvider.xControllerProvider()).to.be.equal(address);
  });

  it('xprovider_set_xcontroller_chain', async function () {
    const { xProvider } = await setupXProvider();
    const chainid = random(10_000);

    await run('xprovider_set_xcontroller_chain', { chainid });
    expect(await xProvider.xControllerChain()).to.be.equal(chainid);
  });

  it('xprovider_set_home_chain', async function () {
    const { xProvider } = await setupXProvider();
    const chainid = random(10_000);

    await run('xprovider_set_home_chain', { chainid });
    expect(await xProvider.homeChain()).to.be.equal(chainid);
  });

  it('xprovider_set_game_chain', async function () {
    const { xProvider } = await setupXProvider();
    const chainid = random(10_000);

    await run('xprovider_set_game_chain', { chainid });
    expect(await xProvider.gameChain()).to.be.equal(chainid);
  });

  it('xprovider_vault_whitelist', async function () {
    const { xProvider } = await setupXProvider();
    const vault = '0x5274891bEC421B39D23760c04A6755eCB444797C';

    expect(await xProvider.vaultWhitelist(vault)).to.be.equal(false);
    await run('xprovider_vault_whitelist', { address: vault });
    expect(await xProvider.vaultWhitelist(vault)).to.be.equal(true);
    await run('xprovider_vault_whitelist', { address: vault });
    expect(await xProvider.vaultWhitelist(vault)).to.be.equal(false);
  });

  it('xprovider_set_dao', async function () {
    const { xProvider } = await setupXProvider();
    const dao = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';

    await run('xprovider_set_dao', { address: dao });
    expect(await xProvider.getDao()).to.be.equal(dao);
  });

  it('xprovider_set_game', async function () {
    const { xProvider } = await setupXProvider();
    const address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    await run('xprovider_set_game', { address });
    expect(await xProvider.game()).to.be.equal(address);
  });

  const random = (max: number) => Math.floor(Math.random() * max);

  async function deployXProvider(
    deployments: DeploymentsExtension,
    ethers: HardhatEthersHelpers,
  ): Promise<XProvider> {
    await deployments.fixture(['XProvider']);
    const deployment = await deployments.get('XProvider');
    const xProvider: XProvider = await ethers.getContractAt('XProvider', deployment.address);

    return xProvider;
  }
});
