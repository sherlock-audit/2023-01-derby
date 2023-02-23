import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { XChainControllerMock } from '@typechain';
import { DeploymentsExtension } from 'hardhat-deploy/types';
import { HardhatEthersHelpers } from 'hardhat/types';

describe('Testing xController tasks', () => {
  const setupXController = deployments.createFixture(
    async ({ ethers, deployments, getNamedAccounts }) => {
      const amount = 1_000_000 * 1e6;
      const chainids = [10, 100, 1000];

      const accounts = await getNamedAccounts();
      const user = await ethers.getSigner(accounts.user);

      const xController = await deployXChainController(deployments, ethers);
      await run('xcontroller_init', { chainids, homexprovider: xController.address });

      return { xController, user };
    },
  );

  /*************
  Only Guardian
  **************/

  it('xcontroller_set_chain_ids', async function () {
    const { xController } = await setupXController();
    const chainids = [
      random(1000),
      random(1000),
      random(1000),
      random(1000),
      random(1000),
      random(1000),
    ];

    await run('xcontroller_set_chain_ids', { chainids });
    expect(await xController.getChainIds()).to.be.deep.equal(chainids);
  });

  it('xcontroller_reset_vault_stages', async function () {
    const { xController } = await setupXController();
    const vaultnumber = random(100);

    await xController.setReadyTEST(vaultnumber, true);
    await xController.setAllocationsReceivedTEST(vaultnumber, true);
    await xController.upUnderlyingReceivedTEST(vaultnumber);
    await xController.setReadyTEST(vaultnumber, false);

    const vaultstageBefore = await xController.vaultStage(vaultnumber);
    expect(vaultstageBefore.ready).to.be.equal(false);
    expect(vaultstageBefore.allocationsReceived).to.be.equal(true);
    expect(vaultstageBefore.underlyingReceived).to.be.equal(1);

    await run('xcontroller_reset_vault_stages', { vaultnumber });

    const vaultstage = await xController.vaultStage(vaultnumber);
    expect(vaultstage.ready).to.be.equal(true);
    expect(vaultstage.allocationsReceived).to.be.equal(false);
    expect(vaultstage.underlyingReceived).to.be.equal(0);
    expect(vaultstage.fundsReceived).to.be.equal(0);
  });

  it('xcontroller_receive_allocations', async function () {
    const { xController } = await setupXController();
    const chainIds = [10, 100, 1000];
    const vaultnumber = random(100);
    const deltas = [random(100_000 * 1e6), random(100_000 * 1e6), random(100_000 * 1e6)];

    await xController.setReadyTEST(vaultnumber, true);
    await run('xcontroller_receive_allocations', { vaultnumber, deltas });

    const allocationPromise = chainIds.map((chain) => {
      return xController.getCurrentAllocationTEST(vaultnumber, chain);
    });
    const allocations = await Promise.all(allocationPromise);

    expect(allocations).to.be.deep.equal(deltas);
  });

  it('xcontroller_set_totalunderlying', async function () {
    const { xController } = await setupXController();
    const vaultnumber = random(100);
    const chainid = random(10_000);
    const underlying = random(10_000_000 * 1e6);
    const totalsupply = random(10_000_000 * 1e6);
    const withdrawalrequests = random(1_000_000 * 1e6);

    await run('xcontroller_set_totalunderlying', {
      vaultnumber,
      chainid,
      underlying,
      totalsupply,
      withdrawalrequests,
    });

    expect(await xController.getTotalUnderlyingOnChainTEST(vaultnumber, chainid)).to.be.equal(
      underlying,
    );
    expect(await xController.getWithdrawalRequestsTEST(vaultnumber, chainid)).to.be.equal(
      withdrawalrequests,
    );
    expect(await xController.getTotalSupplyTEST(vaultnumber)).to.be.equal(totalsupply);
    expect(await xController.getTotalUnderlyingVaultTEST(vaultnumber)).to.be.equal(underlying);
    expect(await xController.getTotalWithdrawalRequestsTEST(vaultnumber)).to.be.equal(
      withdrawalrequests,
    );
    expect((await xController.vaultStage(vaultnumber)).underlyingReceived).to.be.equal(1);
  });

  it('xcontroller_guardian_setters', async function () {
    const { xController } = await setupXController();
    const vaultnumber = random(100);
    const activeVaults = random(20);
    const underlyingReceived = random(20);

    await run('xcontroller_set_active_vaults', { vaultnumber, activevaults: activeVaults });
    await run('xcontroller_set_ready', { vaultnumber, state: true });
    await run('xcontroller_set_allocations_received', { vaultnumber, state: true });
    await run('xcontroller_set_underlying_received', { vaultnumber, received: underlyingReceived });

    const vaultStage = await xController.vaultStage(vaultnumber);
    expect(vaultStage.activeVaults).to.be.equal(activeVaults);
    expect(vaultStage.ready).to.be.equal(true);
    expect(vaultStage.allocationsReceived).to.be.equal(true);
    expect(vaultStage.underlyingReceived).to.be.equal(underlyingReceived);
  });

  /*************
  Only Dao
  **************/

  it('xcontroller_set_vault_chain_address', async function () {
    const { xController } = await setupXController();
    const vaultnumber = random(100);
    const chainid = random(50_000);
    const vaultAddress = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const underlying = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('xcontroller_set_vault_chain_address', {
      vaultnumber,
      chainid,
      address: vaultAddress,
      underlying,
    });

    expect(await xController.getUnderlyingAddressTEST(vaultnumber, chainid)).to.be.equal(
      underlying,
    );
    expect(await xController.getVaultAddressTEST(vaultnumber, chainid)).to.be.equal(vaultAddress);
  });

  it('xcontroller_set_homexprovider', async function () {
    const { xController } = await setupXController();
    const address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('xcontroller_set_homexprovider', { address });
    expect(await xController.xProvider()).to.be.equal(address);
  });

  it('xcontroller_set_home_chain', async function () {
    const { xController } = await setupXController();
    const chainid = random(10_000);

    await run('xcontroller_set_home_chain', { chainid });
    expect(await xController.homeChain()).to.be.equal(chainid);
  });

  it('xcontroller_set_dao', async function () {
    const { xController } = await setupXController();
    const dao = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('xcontroller_set_dao', { address: dao });
    expect(await xController.getDao()).to.be.equal(dao);
  });

  it('xcontroller_set_guardian', async function () {
    const { xController } = await setupXController();
    const guardian = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('xcontroller_set_guardian', { guardian });
    expect(await xController.getGuardian()).to.be.equal(guardian);
  });

  it('xcontroller_set_game', async function () {
    const { xController } = await setupXController();
    const address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    await run('xcontroller_set_game', { address });
    expect(await xController.game()).to.be.equal(address);
  });

  it('xcontroller_set_minimum_amount', async function () {
    const { xController } = await setupXController();
    const amount = random(10_00) * 1e6;

    await run('xcontroller_set_minimum_amount', { amount });
    expect(await xController.minimumAmount()).to.be.equal(amount);
  });

  const random = (max: number) => Math.floor(Math.random() * max);

  async function deployXChainController(
    deployments: DeploymentsExtension,
    ethers: HardhatEthersHelpers,
  ): Promise<XChainControllerMock> {
    await deployments.fixture(['XChainControllerMock']);
    const deployment = await deployments.get('XChainControllerMock');
    const xController: XChainControllerMock = await ethers.getContractAt(
      'XChainControllerMock',
      deployment.address,
    );

    return xController;
  }
});
