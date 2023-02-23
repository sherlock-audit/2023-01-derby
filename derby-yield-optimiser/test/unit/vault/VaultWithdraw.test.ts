import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, parseUSDC } from '@testhelp/helpers';
import { usdc, starterProtocols as protocols } from '@testhelp/addresses';
import { setupVault } from './setup';
import { run } from 'hardhat';

describe('Testing VaultWithdraw, unit test', async () => {
  const IUSDc: Contract = erc20(usdc);

  const compoundVault = protocols.get('compound_usdc_01')!;
  const aaveVault = protocols.get('aave_usdc_01')!;
  const yearnVault = protocols.get('yearn_usdc_01')!;

  it('Should not be able to withdraw when vault is off', async function () {
    const { vault, user } = await setupVault();
    await vault.toggleVaultOnOffTEST(true);

    await expect(
      vault.connect(user).withdraw(1 * 1e6, user.address, user.address),
    ).to.be.revertedWith('Vault is off');
    await vault.toggleVaultOnOffTEST(false);
  });

  it('Should be able to withdraw LP tokens from vault balance', async function () {
    const { vault, user } = await setupVault();
    // 100k USDC to vault
    await IUSDc.connect(user).transfer(vault.address, 100_000 * 1e6);
    // deposit 50k USDC
    await vault.connect(user).deposit(50_000 * 1e6, user.address);

    await expect(() =>
      vault.connect(user).withdraw(10_000 * 1e6, user.address, user.address),
    ).to.changeTokenBalance(IUSDc, user, 10_000 * 1e6);

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.05 * 1e6);

    let expectedUSDCReceived = 10_000 * 1.05 * 1e6;
    await expect(() =>
      vault.connect(user).withdraw(10_000 * 1e6, user.address, user.address),
    ).to.changeTokenBalance(IUSDc, user, expectedUSDCReceived);

    // mocking exchangerate to 1.05
    await vault.setExchangeRateTEST(1.2 * 1e6);

    expectedUSDCReceived = 30_000 * 1.2 * 1e6;
    await expect(() =>
      vault.connect(user).withdraw(30_000 * 1e6, user.address, user.address),
    ).to.changeTokenBalance(IUSDc, user, expectedUSDCReceived);
  });

  it('Should be able to withdraw LP tokens from vault balance and protocols', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(100_000 * 1e6, user.address);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40 * 1e6),
      aaveVault.setDeltaAllocation(vault, 60 * 1e6),
      yearnVault.setDeltaAllocation(vault, 20 * 1e6),
    ]);

    // mocking vault in correct state and exchangerate to 1.05
    await Promise.all([
      vault.setExchangeRateTEST(1.05 * 1e6),
      vault.setVaultState(3),
      vault.setDeltaAllocationsReceivedTEST(true),
    ]);
    await vault.rebalance();
    await vault.setVaultState(0);

    await expect(
      vault.connect(user).withdraw(20_000 * 1e6, user.address, user.address),
    ).to.be.revertedWith('!funds');
  });

  it('Should set withdrawal request and withdraw the allowance later', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(parseUSDC(10_000), user.address); // 10k
    expect(await vault.totalSupply()).to.be.equal(parseUSDC(10_000)); // 10k

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(parseUSDC(0.9));

    // withdrawal request for more then LP token balance
    await expect(vault.connect(user).withdrawalRequest(parseUSDC(10_001))).to.be.revertedWith(
      'ERC20: burn amount exceeds balance',
    );

    // withdrawal request for 10k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC(10_000)),
    ).to.changeTokenBalance(vault, user, -parseUSDC(10_000));

    // check withdrawalAllowance user and totalsupply
    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC(9_000));
    expect(await vault.totalSupply()).to.be.equal(parseUSDC(0));

    // trying to withdraw allowance before the vault reserved the funds
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('');

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setReservedFundsTEST(parseUSDC(10_000));

    // withdraw allowance should give 9k USDC
    await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
      IUSDc,
      user,
      parseUSDC(9_000),
    );

    // trying to withdraw allowance again
    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('!Allowance');
  });

  it('Withdrawal request and withdraw when the divergence in checkForBalance too big', async function () {
    const { vault, user } = await setupVault();
    await vault.connect(user).deposit(parseUSDC(10_000), user.address); // 10k
    expect(await vault.totalSupply()).to.be.equal(parseUSDC(10_000)); // 10k

    // withdrawal request for 10k LP tokens
    await expect(() =>
      vault.connect(user).withdrawalRequest(parseUSDC(10_000)),
    ).to.changeTokenBalance(vault, user, -parseUSDC(10_000));

    expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(parseUSDC(10_000));

    // mocking vault settings
    await vault.upRebalancingPeriodTEST();
    await vault.setReservedFundsTEST(parseUSDC(10_000));

    // removing vault balance so the divergence will be greater than maxDivergenceWithdraws
    await vault.clearCurrencyBalance(parseUSDC(10));

    await expect(vault.connect(user).withdrawAllowance()).to.be.revertedWith('Max divergence');
  });

  describe('Testing governance fee', async () => {
    it('Should send governance fee to dao on withdraw function', async function () {
      const { vault, user, dao, contract } = await setupVault();
      await run('vault_set_governance_fee', { contract: contract, fee: 10 });

      await vault.connect(user).deposit(parseUSDC(20_000), user.address);

      // 0.1% of 10k withdraw
      const govFee = 10_000 * 0.001;

      await expect(() =>
        vault.connect(user).withdraw(parseUSDC(10_000), user.address, user.address),
      ).to.changeTokenBalance(IUSDc, user, parseUSDC(10_000 - govFee));

      expect(await IUSDc.balanceOf(dao.address)).to.be.equal(parseUSDC(govFee));
    });

    it('Should send governance fee to dao on withdraw allowance function', async function () {
      const { vault, user, dao, contract } = await setupVault();
      await run('vault_set_governance_fee', { contract: contract, fee: 50 });

      await vault.connect(user).deposit(parseUSDC(20_000), user.address);

      // withdrawal request for 20k LP tokens
      await expect(() =>
        vault.connect(user).withdrawalRequest(parseUSDC(20_000)),
      ).to.changeTokenBalance(vault, user, -parseUSDC(20_000));

      // mocking vault settings
      await vault.upRebalancingPeriodTEST();
      await vault.setReservedFundsTEST(parseUSDC(20_000));
      const govFee = 20_000 * 0.005;

      // withdraw allowance should give 9k USDC
      await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
        IUSDc,
        user,
        parseUSDC(20_000 - govFee),
      );

      expect(await IUSDc.balanceOf(dao.address)).to.be.equal(parseUSDC(govFee));
    });
  });
});
