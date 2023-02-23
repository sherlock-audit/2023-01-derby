import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import {
  erc20,
  formatUSDC,
  parseEther,
  formatEther,
  transferAndApproveUSDC,
  transferAndApproveDAI,
} from '@testhelp/helpers';
import type { IdleProvider } from '@typechain';
import { dai, usdc, idleUSDC as iUSDC, idleDAI as iDAI } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Idle provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['IdleProvider']);
    const provider = (await getContract('IdleProvider', hre)) as IdleProvider;
    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);
    await transferAndApproveDAI(provider.address, user, 1_000_000);

    return { provider, user };
  });

  describe('Testing idleUSDC', () => {
    let provider: IdleProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IiUSDC: Contract = erc20(iUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(iUSDC);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in iUSDC', async () => {
      const expectedShares = Math.round(amount / Number(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, iUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const iUSDCBalance = await provider.balance(user.address, iUSDC);
      expect(formatEther(iUSDCBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, iUSDC);

      const iUSDCBalance = await provider.balance(user.address, iUSDC);
      expect(formatEther(iUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, iUSDC);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const iUSDCBalance = await provider.balance(user.address, iUSDC);

      await IiUSDC.connect(user).approve(provider.address, iUSDCBalance);

      await expect(() =>
        provider.connect(user).withdraw(iUSDCBalance, iUSDC, usdc),
      ).to.changeTokenBalance(IUSDc, user, amount - 1);
    });
  });

  describe('Testing idleDAI', () => {
    let provider: IdleProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IiDAI: Contract = erc20(iDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(iDAI);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in iDAI', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, iDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const iDAIBalance = await provider.balance(user.address, iDAI);
      expect(formatEther(iDAIBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, iDAI);

      const iDAIBalance = await provider.balance(user.address, iDAI);
      expect(formatEther(iDAIBalance)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, iDAI);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const iDAIBalance = await provider.balance(user.address, iDAI);

      await IiDAI.connect(user).approve(provider.address, iDAIBalance);

      await expect(() =>
        provider.connect(user).withdraw(iDAIBalance, iDAI, dai),
      ).to.changeTokenBalance(IDAI, user, amount.sub(1)); // close to, 1
    });
  });
});
