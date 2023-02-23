import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { MainVaultMock } from '@typechain';
import { random, transferAndApproveUSDC } from '@testhelp/helpers';
import { getContract } from '@testhelp/getContracts';
import { getInitConfigVault } from '@testhelp/deployHelpers';

describe('Testing vault tasks', () => {
  const setupVault = deployments.createFixture(async (hre) => {
    const { ethers, deployments, getNamedAccounts, network } = hre;
    const amount = 1_000_000 * 1e6;
    const contract = 'TestVault1';
    await deployments.fixture([contract]);

    const accounts = await getNamedAccounts();
    const user = await ethers.getSigner(accounts.user);
    const vault = (await getContract(contract, hre, 'MainVaultMock')) as MainVaultMock;

    await run('vault_init', { contract });
    await transferAndApproveUSDC(vault.address, user, amount);
    const initSettings = await getInitConfigVault(contract, network.name);

    return { vault, user, contract, initSettings };
  });

  /*************
  Only Guardian
  **************/

  it('vault_set_state', async function () {
    const { vault, contract } = await setupVault();

    expect(await vault.state()).to.be.equal(0);
    await run('vault_set_state', { contract, state: 2 });
    expect(await vault.state()).to.be.equal(2);
    await run('vault_set_state', { contract, state: 4 });
    expect(await vault.state()).to.be.equal(4);
  });

  it('vault_set_home_chain', async function () {
    const { vault, contract } = await setupVault();
    const chainid = random(10_000);

    await run('vault_set_home_chain', { contract, chainid });
    expect(await vault.homeChain()).to.be.equal(chainid);
  });

  it('vault_set_rebalance_interval', async function () {
    const { vault, contract } = await setupVault();
    const timestamp = random(100_000_000);

    await run('vault_set_rebalance_interval', { contract, timestamp });
    expect(await vault.rebalanceInterval()).to.be.equal(timestamp);
  });

  it('vault_set_margin_scale', async function () {
    const { vault, contract, initSettings } = await setupVault();
    const scale = random(100_000_000_000);

    expect(await vault.marginScale()).to.be.equal(initSettings.marginScale);
    await run('vault_set_margin_scale', { contract, scale });
    expect(await vault.marginScale()).to.be.equal(scale);
  });

  it('vault_set_liquidity_perc', async function () {
    const { vault, contract, initSettings } = await setupVault();
    const percentage = random(100);

    expect(await vault.liquidityPerc()).to.be.equal(initSettings.liquidityPercentage);
    await run('vault_set_liquidity_perc', { contract, percentage });
    expect(await vault.liquidityPerc()).to.be.equal(percentage);
  });

  /*************
  Only Dao
  **************/

  it('vault_set_dao', async function () {
    const { vault, contract } = await setupVault();
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('vault_set_dao', { contract, address: dao });
    expect(await vault.getDao()).to.be.equal(dao);
  });

  it('vault_set_guardian', async function () {
    const { vault, contract } = await setupVault();
    const guardian = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('vault_set_guardian', { contract, guardian });
    expect(await vault.getGuardian()).to.be.equal(guardian);
  });

  it('vault_set_homexprovider', async function () {
    const { vault, contract } = await setupVault();
    const address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('vault_set_homexprovider', { contract, address });
    expect(await vault.xProvider()).to.be.equal(address);
  });

  it('vault_set_dao_token', async function () {
    const { vault, contract } = await setupVault();
    const address = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('vault_set_dao_token', { contract, address });
    expect(await vault.derbyToken()).to.be.equal(address);
  });

  it('vault_set_game', async function () {
    const { vault, contract } = await setupVault();
    const address = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    await run('vault_set_game', { contract, address });
    expect(await vault.game()).to.be.equal(address);
  });

  it('vault_set_swap_rewards', async function () {
    const { vault, contract } = await setupVault();

    // true cause of vault_init
    expect(await vault.swapRewards()).to.be.equal(true);
    await run('vault_set_swap_rewards', { contract, state: false });
    expect(await vault.swapRewards()).to.be.equal(false);
  });

  it('vault_set_performance_fee', async function () {
    const { vault, contract, initSettings } = await setupVault();
    const fee = random(100);

    expect(await vault.performanceFee()).to.be.equal(initSettings.performanceFee);
    await run('vault_set_performance_fee', { contract, percentage: fee });
    expect(await vault.performanceFee()).to.be.equal(fee);
  });

  it('vault_set_governance_fee', async function () {
    const { vault, contract } = await setupVault();
    const fee = random(10_000);

    await run('vault_set_governance_fee', { contract, fee: fee });
    expect(await vault.governanceFee()).to.be.equal(fee);
  });

  it('vault_set_max_divergence', async function () {
    const { vault, contract } = await setupVault();
    const divergence = random(100) * 1e6;

    await run('vault_set_max_divergence', { contract, divergence });
    expect(await vault.maxDivergenceWithdraws()).to.be.equal(divergence);
  });
});
