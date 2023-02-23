import { expect } from 'chai';
import { parseEther, parseUnits, transferAndApproveUSDC } from '@testhelp/helpers';
import type { Controller, MainVaultMock } from '@typechain';
import {
  compound_dai_01,
  aave_usdt_01,
  yearn_usdc_01,
  aave_usdc_01,
  compound_usdc_01,
  compoundUSDC,
  compoundDAI,
  aaveUSDC,
  yearnUSDC,
  aaveUSDT,
} from '@testhelp/addresses';
import AllMockProviders from '@testhelp/classes/allMockProvidersClass';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';
import { deployments, run } from 'hardhat';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Vault Store Price and Rewards, unit test', async () => {
  let vault: MainVaultMock;

  const protocols = new Map<string, ProtocolVault>()
    .set('compound_usdc_01', compound_usdc_01)
    .set('aave_usdc_01', aave_usdc_01)
    .set('yearn_usdc_01', yearn_usdc_01)
    .set('compound_dai_01', compound_dai_01)
    .set('aave_usdt_01', aave_usdt_01);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;
  const compoundDAIVault = protocols.get('compound_dai_01')!;
  const aaveUSDTVault = protocols.get('aave_usdt_01')!;

  const setupVault = deployments.createFixture(async (hre) => {
    await deployments.fixture(['TestVault1']);

    const vaultNumber = 10;
    const contract = 'TestVault1';
    const [dao, user, guardian] = await getAllSigners(hre);

    const vault = (await getContract(contract, hre, 'MainVaultMock')) as MainVaultMock;
    const controller = (await getContract('Controller', hre)) as Controller;

    await AllMockProviders.deployAllMockProviders(dao);
    await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

    await run('vault_init', { contract });
    await run('controller_init');
    await run('controller_add_vault', { vault: vault.address });
    await run('vault_set_liquidity_perc', { contract, percentage: 10 });

    // add all protocol vaults to controller with mocked providers
    for (const protocol of protocols.values()) {
      await protocol.addProtocolToController(controller, dao, vaultNumber, AllMockProviders);
    }

    return { vault, controller, dao, user, guardian };
  });

  before(async function () {
    const setup = await setupVault();
    vault = setup.vault;
  });

  it('Should store historical prices and rewards, rebalance: 1', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    compoundVault.setPrice(parseUnits('1000', 8));
    aaveVault.setPrice(parseUnits('2000', 6));
    yearnVault.setPrice(parseUnits('3000', 6));
    compoundDAIVault.setPrice(parseUnits('4000', 8));
    aaveUSDTVault.setPrice(parseUnits('5000', 6));

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price),
    ]);

    await vault.setTotalAllocatedTokensTest(parseEther('10000')); // 10k
    const rebalancePeriod = await vault.rebalancingPeriod();
    const totalUnderlying = 100_000 * 1e6;

    // first time it will only store the last price
    for (const { number, price } of protocols.values()) {
      await vault.storePriceAndRewardsTest(totalUnderlying, number);

      expect(await vault.lastPrices(number)).to.be.equal(price);
      expect(await vault.rewardPerLockedToken(rebalancePeriod, number)).to.be.equal(0);
    }
  });

  it('Should store historical prices and rewards, rebalance: 2', async function () {
    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;

    // expectedRewards = (totalUnderlying * performanceFee * priceDiff) / (totalAllocatedTokens * lastPrice)
    compoundVault.setPrice(parseUnits('1100', 8)).setExpectedReward(100_000); // 10%
    aaveVault.setPrice(parseUnits('2100', 6)).setExpectedReward(50000); // 5%
    yearnVault.setPrice(parseUnits('3030', 6)).setExpectedReward(10_000); // 1%
    compoundDAIVault.setPrice(parseUnits('4004', 8)).setExpectedReward(1_000); // 0.1%
    aaveUSDTVault.setPrice(parseUnits('5010', 6)).setExpectedReward(2_000); // 0.2%

    await Promise.all([
      compoundProvider.mock.exchangeRate.withArgs(compoundUSDC).returns(compoundVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDC).returns(aaveVault.price),
      yearnProvider.mock.exchangeRate.withArgs(yearnUSDC).returns(yearnVault.price),
      compoundProvider.mock.exchangeRate.withArgs(compoundDAI).returns(compoundDAIVault.price),
      aaveProvider.mock.exchangeRate.withArgs(aaveUSDT).returns(aaveUSDTVault.price),
    ]);

    await vault.upRebalancingPeriodTEST();
    const rebalancePeriod = await vault.rebalancingPeriod();
    const totalUnderlying = 100_000 * 1e6;

    for (const { number, price, expectedReward } of protocols.values()) {
      await vault.storePriceAndRewardsTest(totalUnderlying, number);

      expect(await vault.lastPrices(number)).to.be.equal(price);
      expect(await vault.rewardPerLockedToken(rebalancePeriod, number)).to.be.equal(expectedReward);
    }
  });
});
