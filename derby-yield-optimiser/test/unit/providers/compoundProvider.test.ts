import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import {
  erc20,
  formatUSDC,
  parseEther,
  formatEther,
  transferAndApproveUSDC,
  formatUnits,
  transferAndApproveDAI,
} from '@testhelp/helpers';
import type { CompoundProvider } from '@typechain';
import { dai, usdc, compoundUSDC as cUSDC, compoundDAI as cDAI } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Compound provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['CompoundProvider']);
    const provider = (await getContract('CompoundProvider', hre)) as CompoundProvider;
    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);
    await transferAndApproveDAI(provider.address, user, 1_000_000);

    return { provider, user };
  });

  describe('Testing compoundUSDC', () => {
    let provider: CompoundProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IcUSDC: Contract = erc20(cUSDC);
    const amount = 100_000 * 1e6;
    const decimals = 8;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(cUSDC);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in cUSDC', async () => {
      await expect(() => provider.connect(user).deposit(amount, cUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const expectedShares = Math.round((amount * 1e12) / Number(exchangeRate));
      const cUSDCBalance = await provider.balance(user.address, cUSDC);
      expect(formatUSDC(cUSDCBalance)).to.be.closeTo(expectedShares, 800);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, cUSDC);

      const cUSDCBalance = await provider.balance(user.address, cUSDC);
      expect(formatUnits(cUSDCBalance, 8)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, cUSDC);

      expect(formatUnits(balanceUnderlying, 8)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const cUSDCBalance = await provider.balance(user.address, cUSDC);

      await IcUSDC.connect(user).approve(provider.address, cUSDCBalance);
      await provider.connect(user).withdraw(cUSDCBalance, cUSDC, usdc);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatUSDC(await IUSDc.balanceOf(user.address))).to.be.closeTo(10_000_000, 250);
    });
  });

  describe('Testing compoundDAI', () => {
    let provider: CompoundProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IcDAI: Contract = erc20(cDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(cDAI);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in cDAI', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, cDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const cDAIBalance = await provider.balance(user.address, cDAI);
      expect(formatEther(cDAIBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, cDAI);

      const cDAIBalance = await provider.balance(user.address, cDAI);
      expect(formatUnits(cDAIBalance, 8)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, cDAI);

      expect(formatUnits(balanceUnderlying, 8)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const cDAIBalance = await provider.balance(user.address, cDAI);

      await IcDAI.connect(user).approve(provider.address, cDAIBalance);
      await provider.connect(user).withdraw(cDAIBalance, cDAI, dai);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatEther(await IDAI.balanceOf(user.address))).to.be.closeTo(1_000_000, 250);
    });
  });

  // it('Should claim Comp tokens from Comptroller', async function () {
  //   await compoundProviderMock.connect(vault).claim(cusdc, vaultAddr);

  //   const compBalanceBefore = Number(await compToken.balanceOf(cusdcWhaleAddr));
  //   await compoundProviderMock.connect(cusdcWhale).claimTest(cusdcWhaleAddr, cusdc);
  //   const compBalanceAfter = Number(await compToken.balanceOf(cusdcWhaleAddr));

  //   console.log(`Balance Before ${compBalanceBefore}`);
  //   console.log(`Balance After ${compBalanceAfter}`);

  //   expect(compBalanceAfter).to.be.greaterThan(compBalanceBefore);
  // });
});
