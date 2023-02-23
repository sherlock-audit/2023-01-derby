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
import type { BetaProvider } from '@typechain';
import { dai, usdc, betaUSDC as bUSDC, betaDAI as bDAI } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Beta provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['BetaProvider']);
    const provider = (await getContract('BetaProvider', hre)) as BetaProvider;
    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);
    await transferAndApproveDAI(provider.address, user, 1_000_000);

    return { provider, user };
  });

  describe('Testing betaUSDC', () => {
    let provider: BetaProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IbUSDC: Contract = erc20(bUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should deposit in bUSDC', async () => {
      const expectedShares = formatUSDC(await provider.calcShares(amount, bUSDC));

      await expect(() => provider.connect(user).deposit(amount, bUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const bUSDCBalance = await provider.balance(user.address, bUSDC);
      expect(formatUSDC(bUSDCBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, bUSDC);

      const bUSDCBalance = await provider.balance(user.address, bUSDC);
      expect(formatUSDC(bUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, bUSDC);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const bUSDCBalance = await provider.balance(user.address, bUSDC);

      await IbUSDC.connect(user).approve(provider.address, bUSDCBalance);

      const balanceBefore = await IUSDc.balanceOf(user.address);
      await provider.connect(user).withdraw(bUSDCBalance, bUSDC, usdc);
      const balanceAfter = await IUSDc.balanceOf(user.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(amount, 10);
    });
  });

  describe('Testing betaDAI', () => {
    let provider: BetaProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IbDAI: Contract = erc20(bDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should deposit in bDAI', async () => {
      const expectedShares = formatEther(await provider.calcShares(amount, bDAI));

      await expect(() => provider.connect(user).deposit(amount, bDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const bDAIBalance = await provider.balance(user.address, bDAI);
      expect(formatEther(bDAIBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, bDAI);

      const bDAIBalance = await provider.balance(user.address, bDAI);
      expect(formatEther(bDAIBalance)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, bDAI);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const bDAIBalance = await provider.balance(user.address, bDAI);

      await IbDAI.connect(user).approve(provider.address, bDAIBalance);
      await provider.connect(user).withdraw(bDAIBalance, bDAI, dai);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatEther(await IDAI.balanceOf(user.address))).to.be.closeTo(1_000_000, 1);
    });
  });
});
