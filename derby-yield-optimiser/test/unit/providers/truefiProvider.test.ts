import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import {
  erc20,
  formatUSDC,
  transferAndApproveUSDC,
  getUSDTSigner,
  parseUnits,
  parseUSDC,
} from '@testhelp/helpers';
import type { TruefiProvider } from '@typechain';
import { usdc, truefiUSDC as tUSDC, usdt, truefiUSDT as tUSDT } from '@testhelp/addresses';
import { getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Truefi provider', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture(['TruefiProvider']);
    const provider = (await getContract('TruefiProvider', hre)) as TruefiProvider;

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);

    // approve and send USDT to user
    const usdtAmount = parseUnits(1_000_000, 6);
    const usdtSigner = await getUSDTSigner();
    const IUSDT = erc20(usdt);
    await IUSDT.connect(usdtSigner).transfer(user.getAddress(), usdtAmount);
    await IUSDT.connect(user).approve(provider.address, usdtAmount);

    return { provider, user };
  });

  describe('Testing truefiUSDC', () => {
    let provider: TruefiProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const ItUSDC: Contract = erc20(tUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(tUSDC);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in tUSDC', async () => {
      const expectedShares = Math.round(amount / Number(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, tUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const tUSDCBalance = await provider.balance(user.address, tUSDC);
      expect(formatUSDC(tUSDCBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, tUSDC);

      const tUSDCBalance = await provider.balance(user.address, tUSDC);
      expect(formatUSDC(tUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, tUSDC);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const tUSDCBalance = await provider.balance(user.address, tUSDC);

      await ItUSDC.connect(user).approve(provider.address, tUSDCBalance);
      await provider.connect(user).withdraw(tUSDCBalance, tUSDC, usdc);

      // end balance should be close to starting balance of 10m minus fees
      expect(formatUSDC(await IUSDc.balanceOf(user.address))).to.be.closeTo(10_000_000, 250); // truefi takes fees
    });
  });

  describe('Testing truefiUSDT', () => {
    let provider: TruefiProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDT: Contract = erc20(usdt);
    const ItUSDT: Contract = erc20(tUSDT);
    const amount = parseUSDC(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(tUSDT);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in tUSDT', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, tUSDT, usdt)).to.changeTokenBalance(
        IUSDT,
        user,
        parseUSDC(-100_000),
      );

      const tUSDTBalance = await provider.balance(user.address, tUSDT);
      expect(formatUSDC(tUSDTBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, tUSDT);

      const tUSDTBalance = await provider.balance(user.address, tUSDT);
      expect(formatUSDC(tUSDTBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, tUSDT);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(formatUSDC(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const tUSDTBalance = await provider.balance(user.address, tUSDT);

      await ItUSDT.connect(user).approve(provider.address, tUSDTBalance);

      await expect(() =>
        provider.connect(user).withdraw(tUSDTBalance, tUSDT, usdt),
      ).to.changeTokenBalance(IUSDT, user, amount.sub(2)); // close to, 2
    });
  });
});
