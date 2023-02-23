import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, formatUSDC, parseUSDC } from '@testhelp/helpers';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import AllMockProviders from '@testhelp/classes/allMockProvidersClass';
import { setupVault } from './setup';
import { getDeployConfigVault } from '@testhelp/deployHelpers';

describe('Testing Vault, unit test', async () => {
  const IUSDc: Contract = erc20(usdc),
    vaultNumber: number = 10;

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  const amount = 100_000;
  const amountUSDC = parseUSDC(amount.toString());

  it('Should have a name and symbol', async function () {
    const { vault } = await setupVault();
    const { name, symbol, decimals } = await getDeployConfigVault('TestVault1', 'hardhat');
    expect(await vault.name()).to.be.equal(name);
    expect(await vault.symbol()).to.be.equal(symbol);
    expect(await vault.decimals()).to.be.equal(decimals);
  });

  it('Should set delta allocations', async function () {
    const { vault } = await setupVault();
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      aaveVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    for (const protocol of protocols.values()) {
      const deltaAllocation = await protocol.getDeltaAllocationTEST(vault);
      expect(deltaAllocation).to.be.greaterThan(0);
      expect(deltaAllocation).to.be.equal(protocol.allocation);
    }
  });

  it('Should be able to blacklist protocol and pull all funds', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, 40),
      aaveVault.setExpectedBalance(45_000).setDeltaAllocation(vault, 60),
      yearnVault.setExpectedBalance(15_000).setDeltaAllocation(vault, 20),
    ]);

    await vault.connect(user).deposit(amountUSDC, await user.getAddress());
    await vault.setVaultState(3);
    await vault.rebalance();

    // blacklist compound_usdc_01
    await vault.connect(guardian).blacklistProtocol(compoundVault.number);

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));

    let expectedVaultLiquidity = 40000;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(vaultBalance).to.be.closeTo(expectedVaultLiquidity, 1);
    expect(
      await controller.connect(guardian).getProtocolBlacklist(vaultNumber, compoundVault.number),
    ).to.be.true;
  });

  it('Should not be able to set delta on blacklisted protocol', async function () {
    const { vault, guardian } = await setupVault();
    await vault.connect(guardian).blacklistProtocol(0);
    await expect(vault.setDeltaAllocations(0, 30)).to.be.revertedWith('Protocol on blacklist');
  });

  it('Should not be able to rebalance in blacklisted protocol', async function () {
    const { vault, controller, user, guardian } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);

    await Promise.all([
      compoundVault.setExpectedBalance(0).setDeltaAllocation(vault, 40),
      aaveVault.setExpectedBalance(45_000).setDeltaAllocation(vault, 60),
      yearnVault.setExpectedBalance(15_000).setDeltaAllocation(vault, 20),
    ]);

    await vault.connect(guardian).blacklistProtocol(compoundVault.number);
    await vault.connect(user).deposit(amountUSDC, await user.getAddress());

    await vault.setVaultState(3);
    await vault.rebalance();

    let vaultBalance = formatUSDC(await IUSDc.balanceOf(vault.address));

    let expectedVaultLiquidity = 40000;

    for (const protocol of protocols.values()) {
      const balance = await protocol.balanceUnderlying(vault);
      expect(formatUSDC(balance)).to.be.closeTo(protocol.expectedBalance, 1);
    }

    expect(Number(vaultBalance)).to.be.closeTo(expectedVaultLiquidity, 1);
    const result = await controller
      .connect(guardian)
      .getProtocolBlacklist(vaultNumber, compoundVault.number);
    expect(result).to.be.true;
  });

  it('Should test rebalanceNeeded function', async function () {
    const { vault, user, guardian } = await setupVault();
    await vault.connect(guardian).setRebalanceInterval(1_000_000);

    expect(await vault.rebalanceNeeded()).to.be.false;
    expect(await vault.connect(guardian).rebalanceNeeded()).to.be.true;
  });

  it('Should store prices on rebalance', async function () {
    const { vault, user, dao } = await setupVault();
    await AllMockProviders.deployAllMockProviders(dao);

    const { yearnProvider, compoundProvider, aaveProvider } = AllMockProviders;
    await vault.setDeltaAllocationsReceivedTEST(true);
    let compoundPrice = 1;
    let aavePrice = 2;
    let yearnPrice = 3;
    await Promise.all([
      compoundProvider.mock.exchangeRate.returns(compoundPrice),
      aaveProvider.mock.exchangeRate.returns(aavePrice),
      yearnProvider.mock.exchangeRate.returns(yearnPrice),
      compoundProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.balanceUnderlying.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.deposit.returns(0), // to be able to use the rebalance function
      compoundProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
      aaveProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
      yearnProvider.mock.withdraw.returns(0), // to be able to use the rebalance function
    ]);
    await vault.setTotalUnderlying();

    // await setDeltaAllocations(user, vaultMock, allProtocols);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      aaveVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);
    await vault.connect(user).deposit(amountUSDC, await user.getAddress());
    await vault.setVaultState(3);
    await vault.rebalance();
  });
});
