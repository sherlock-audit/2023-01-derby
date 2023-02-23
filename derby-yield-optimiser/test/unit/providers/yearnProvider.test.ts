import { expect } from 'chai';
import { BigNumber, Contract, Signer } from 'ethers';
import { deployments } from 'hardhat';
import {
  erc20,
  formatUSDC,
  getDAISigner,
  parseEther,
  formatEther,
  transferAndApproveUSDC,
  transferAndApproveDAI,
} from '@testhelp/helpers';
import type { YearnProvider, YearnVaultMock } from '@typechain';
import { dai, usdc, yearnUSDC as yUSDC, yearnDAI as yDAI } from '@testhelp/addresses';
import { deployYearnMockVaults, getAllSigners, getContract } from '@testhelp/getContracts';

describe('Testing Yearn provider for Mock vaults', async () => {
  const setupProvider = deployments.createFixture(async (hre) => {
    await deployments.fixture([
      'YearnMockUSDC1',
      'YearnMockUSDC2',
      'YearnMockDAI1',
      'YearnMockDAI2',
      'YearnMockUSDT1',
      'YearnProvider',
    ]);
    const provider = (await getContract('YearnProvider', hre)) as YearnProvider;
    const [yearnUSDC, , yearnDAI, , yearnUSDT] = await deployYearnMockVaults(hre);

    const [dao, user] = await getAllSigners(hre);

    await transferAndApproveUSDC(provider.address, user, 10_000_000 * 1e6);
    await transferAndApproveDAI(provider.address, user, 1_000_000);

    // approve and send DAI to user
    const daiAmount = parseEther(1_000_000);
    const daiSigner = await getDAISigner();
    const IDAI = erc20(dai);
    await IDAI.connect(daiSigner).transfer(user.getAddress(), daiAmount);
    await IDAI.connect(user).approve(provider.address, daiAmount);

    return { provider, yearnUSDC, yearnDAI, yearnUSDT, user };
  });

  describe('Testing yearnUSDC', () => {
    let provider: YearnProvider, user: Signer, exchangeRate: BigNumber;
    const IUSDc: Contract = erc20(usdc);
    const IyUSDC: Contract = erc20(yUSDC);
    const amount = 100_000 * 1e6;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(yUSDC);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in yUSDC', async () => {
      const expectedShares = Math.round(amount / Number(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, yUSDC, usdc)).to.changeTokenBalance(
        IUSDc,
        user,
        -amount,
      );

      const yUSDCBalance = await provider.balance(user.address, yUSDC);
      expect(formatUSDC(yUSDCBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, yUSDC);

      const yUSDCBalance = await provider.balance(user.address, yUSDC);
      expect(formatUSDC(yUSDCBalance)).to.be.closeTo(formatUSDC(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, yUSDC);

      expect(formatUSDC(balanceUnderlying)).to.be.closeTo(amount / 1e6, 1);
    });

    it('Should be able to withdraw', async () => {
      const yUSDCBalance = await provider.balance(user.address, yUSDC);

      await IyUSDC.connect(user).approve(provider.address, yUSDCBalance);

      await expect(() =>
        provider.connect(user).withdraw(yUSDCBalance, yUSDC, usdc),
      ).to.changeTokenBalance(IUSDc, user, amount - 1);
    });
  });

  describe('Testing yearnDAI', () => {
    let provider: YearnProvider, user: Signer, exchangeRate: BigNumber;
    const IDAI: Contract = erc20(dai);
    const IyDAI: Contract = erc20(yDAI);
    const amount = parseEther(100_000);

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      exchangeRate = await provider.exchangeRate(yDAI);
      expect(exchangeRate).to.be.greaterThan(1 * 1e6);
    });

    it('Should deposit in yDAI', async () => {
      const expectedShares = Math.round(amount.div(exchangeRate));

      await expect(() => provider.connect(user).deposit(amount, yDAI, dai)).to.changeTokenBalance(
        IDAI,
        user,
        parseEther(-100_000),
      );

      const yDAIBalance = await provider.balance(user.address, yDAI);
      expect(formatEther(yDAIBalance)).to.be.closeTo(expectedShares, 1);
    });

    it('Should calculate shares correctly', async () => {
      const shares = await provider.calcShares(amount, yDAI);

      const yDAIBalance = await provider.balance(user.address, yDAI);
      expect(formatEther(yDAIBalance)).to.be.closeTo(formatEther(shares), 1);
    });

    it('Should calculate balance underlying correctly', async () => {
      const balanceUnderlying = await provider.balanceUnderlying(user.address, yDAI);

      expect(formatEther(balanceUnderlying)).to.be.closeTo(formatEther(amount), 1);
    });

    it('Should be able to withdraw', async () => {
      const yDAIBalance = await provider.balance(user.address, yDAI);

      await IyDAI.connect(user).approve(provider.address, yDAIBalance);

      await expect(() =>
        provider.connect(user).withdraw(yDAIBalance, yDAI, dai),
      ).to.changeTokenBalance(IDAI, user, amount.sub(1)); // close to, 1
    });
  });

  describe('Testing YearnMockVault USDC', () => {
    const IUSDc: Contract = erc20(usdc);
    let provider: YearnProvider, yearnUSDC: YearnVaultMock, user: Signer;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      yearnUSDC = setup.yearnUSDC;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      await yearnUSDC.setExchangeRate(1.2 * 1e6);
      expect(await yearnUSDC.exchangeRate()).to.be.equal(1.2 * 1e6);
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 2
      await yearnUSDC.setExchangeRate(2 * 1e6);

      await expect(() =>
        provider.connect(user).deposit(100_000 * 1e6, yearnUSDC.address, usdc),
      ).to.changeTokenBalance(yearnUSDC, user, (100_000 * 1e6) / 2);
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await yearnUSDC.setExchangeRate(2.5 * 1e6);

      await yearnUSDC.connect(user).approve(provider.address, 20_000 * 1e6);
      await expect(() =>
        provider.connect(user).withdraw(20_000 * 1e6, yearnUSDC.address, usdc),
      ).to.changeTokenBalance(IUSDc, user, 20_000 * 1e6 * 2.5);
    });
  });

  describe('Testing YearnMockVault DAI', () => {
    const IDAI: Contract = erc20(dai);
    let provider: YearnProvider, yearnDAI: YearnVaultMock, user: Signer;

    before(async () => {
      const setup = await setupProvider();
      provider = setup.provider;
      yearnDAI = setup.yearnDAI;
      user = setup.user;
    });

    it('Should have exchangeRate', async function () {
      await yearnDAI.setExchangeRate(parseEther(1.2));
      expect(await yearnDAI.exchangeRate()).to.be.equal(parseEther(1.2));
    });

    it('Should deposit in VaultMock', async () => {
      // set exchangeRate to 1.5
      await yearnDAI.setExchangeRate(parseEther(2));

      await expect(() =>
        provider.connect(user).deposit(parseEther(100_000), yearnDAI.address, dai),
      ).to.changeTokenBalance(yearnDAI, user, parseEther(100_000 / 2));
    });

    it('Should calc balance correctly', async function () {
      expect(await provider.connect(user).balance(user.address, yearnDAI.address)).to.be.equal(
        parseEther(100_000 / 2),
      );
    });

    it('Should calc shares correctly', async function () {
      expect(
        await provider.connect(user).calcShares(parseEther(100_000), yearnDAI.address),
      ).to.be.equal(parseEther(100_000 / 2));
    });

    it('Should calc balanceUnderlying correctly', async function () {
      expect(
        await provider.connect(user).balanceUnderlying(user.address, yearnDAI.address),
      ).to.be.equal(parseEther(100_000));
    });

    it('Should withdraw from VaultMock', async () => {
      // set exchangeRate to 2.5
      await yearnDAI.setExchangeRate(parseEther(2.5));

      await yearnDAI.connect(user).approve(provider.address, parseEther(20_000));
      await expect(() =>
        provider.connect(user).withdraw(parseEther(20_000), yearnDAI.address, dai),
      ).to.changeTokenBalance(IDAI, user, parseEther(20_000 * 2.5));
    });
  });
});
