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
import type { AaveProvider, CompoundProvider } from '@typechain';
import { dai, usdc, aaveUSDC as aUSDC, aaveDAI as aDAI } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Aave provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['AaveProvider']);
    const provider = (await getContract('AaveProvider', hre)) as AaveProvider;
    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);
    await transferAndApproveDAI(provider.address, user, 1_000_000);

    return { provider, user };
  });

  describe('Testing aaveUSDC', () => {
    let provider: AaveProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IaUSDC: Contract = erc20(aUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(aUSDC);
      expect(exchangeRate).to.be.equal(1);
    });

    it('Should deposit in aUSDC', async () => {
      const expectedShares = Math.round(amount / Number(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, aUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const aUSDCBalance = await provider.balance(user.address, aUSDC);
      expect(formatUSDC(aUSDCBalance)).to.be.closeTo(expectedShares / 1e6, 50);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, aUSDC);

      const aUSDCBalance = await provider.balance(user.address, aUSDC);
      expect(formatUSDC(aUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, aUSDC);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const aUSDCBalance = await provider.balance(user.address, aUSDC);

      await IaUSDC.connect(user).approve(provider.address, aUSDCBalance);
      await provider.connect(user).withdraw(aUSDCBalance, aUSDC, usdc);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatUSDC(await IUSDc.balanceOf(user.address))).to.be.closeTo(10_000_000, 250);
    });
  });

  describe('Testing aaveDAI', () => {
    let provider: AaveProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IaDAI: Contract = erc20(aDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(aDAI);
      expect(exchangeRate).to.be.equal(1);
    });

    it('Should deposit in aDAI', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, aDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const aDAIBalance = await provider.balance(user.address, aDAI);
      expect(formatEther(aDAIBalance)).to.be.closeTo(expectedShares / 1e18, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, aDAI);

      const aDAIBalance = await provider.balance(user.address, aDAI);
      expect(formatEther(aDAIBalance)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, aDAI);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const aDAIBalance = await provider.balance(user.address, aDAI);

      await IaDAI.connect(user).approve(provider.address, aDAIBalance);
      await provider.connect(user).withdraw(aDAIBalance, aDAI, dai);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatEther(await IDAI.balanceOf(user.address))).to.be.closeTo(1_000_000, 250);
    });
  });
});
