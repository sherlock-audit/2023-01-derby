import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers, network } from 'hardhat';
import { parseEther } from '@testhelp/helpers';
import { TokenTimelock, DerbyToken } from 'typechain-types';
// import { deployTokenTimeLock, deployDerbyToken } from '@testhelp/deploy';

const name = 'Derby Finance';
const symbol = 'DRB';
const totalSupply = 1_000_000;

describe.skip('Testing TokenTimeLock', async () => {
  let admin: Signer,
    vc: Signer,
    vcAddr: string,
    tokenTimelock: TokenTimelock,
    DerbyToken: DerbyToken;

  beforeEach(async function () {
    [admin, vc] = await ethers.getSigners();
    vcAddr = await vc.getAddress();

    DerbyToken = await deployDerbyToken(admin, name, symbol, parseEther(totalSupply.toString()));

    tokenTimelock = await deployTokenTimeLock(admin, DerbyToken.address);
  });

  it('Should revert when trying to initialize twice and !beneficiary is calling', async function () {
    const amount = parseEther('180000'); // 180k
    const numberOfMonths = 18;
    const monthDurationUnix = 10;
    const { timestamp } = await ethers.provider.getBlock('latest');

    await DerbyToken.increaseAllowance(tokenTimelock.address, amount);
    await tokenTimelock.init(vcAddr, amount, timestamp, numberOfMonths, monthDurationUnix);

    await expect(tokenTimelock.release()).to.be.revertedWith('!beneficiary');

    await expect(
      tokenTimelock.init(vcAddr, amount, timestamp, numberOfMonths, monthDurationUnix),
    ).to.be.revertedWith('already initialized');
  });

  it('Should return 0 before startTimestamp is reached', async function () {
    const amount = parseEther('180000'); // 180k
    const tokensPerMonth = parseEther('10000'); // 10k
    const numberOfMonths = 18;
    const monthDurationUnix = 10;
    const { timestamp } = await ethers.provider.getBlock('latest');

    // setting timestamp + 50 = in the future
    await DerbyToken.increaseAllowance(tokenTimelock.address, amount);
    await tokenTimelock.init(vcAddr, amount, timestamp + 50, numberOfMonths, monthDurationUnix);

    await expect(tokenTimelock.connect(vc).release()).to.be.revertedWith('Nothing to claim');

    let claimableTokens = await tokenTimelock.connect(vc).claimableTokens();
    expect(claimableTokens).to.be.equal(0);

    // forwarding 60 block, should be 1 month of token release
    for (let i = 0; i < 60; i++) await network.provider.send('evm_mine');
    claimableTokens = await tokenTimelock.claimableTokens();
    expect(claimableTokens).to.be.equal(tokensPerMonth.mul(1));
  });

  it('Should time lock tokens and release them by schedule', async function () {
    const amount = parseEther('180000'); // 180k
    const tokensPerMonth = parseEther('10000'); // 10k
    const numberOfMonths = 18;
    const monthDurationUnix = 10;
    const { timestamp } = await ethers.provider.getBlock('latest');

    await DerbyToken.increaseAllowance(tokenTimelock.address, amount);
    await tokenTimelock.init(vcAddr, amount, timestamp, numberOfMonths, monthDurationUnix);

    const balance = await DerbyToken.balanceOf(tokenTimelock.address);
    const tokensPerMonthContract = await tokenTimelock.tokensPerMonth();
    let claimableTokens = await tokenTimelock.claimableTokens();

    expect(balance).to.be.equal(amount);
    expect(tokensPerMonthContract).to.be.equal(tokensPerMonth);
    expect(claimableTokens).to.be.equal(0);

    // skip 5 timeframes of 10 blocks / timestamps == 5 months
    for (let j = 1; j <= 5; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send('evm_mine');
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    let balanceBefore = await DerbyToken.balanceOf(vcAddr);
    await tokenTimelock.connect(vc).release();
    let balanceAfter = await DerbyToken.balanceOf(vcAddr);

    expect(balanceBefore).to.be.equal(0);
    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(5));

    // skip 7 timeframes of 10 blocks / timestamps == 7 months => total of 12 months
    for (let j = 1; j <= 7; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send('evm_mine');
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await DerbyToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(12));

    // skip 5 timeframes of 10 blocks / timestamps == 5 months => total of 17 months
    for (let j = 1; j <= 5; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send('evm_mine');
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(j));
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await DerbyToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(17));

    // skip 3 timeframes of 10 blocks / timestamps == 5 months => total of 20 months
    for (let j = 1; j <= 3; j++) {
      for (let i = 0; i < 10; i++) await network.provider.send('evm_mine');
      claimableTokens = await tokenTimelock.claimableTokens();
      expect(claimableTokens).to.be.equal(tokensPerMonth.mul(1)); // max balance
    }

    await tokenTimelock.connect(vc).release();
    balanceAfter = await DerbyToken.balanceOf(vcAddr);

    expect(balanceAfter).to.be.equal(tokensPerMonth.mul(18)); // 18 is max

    const balanceContract = await DerbyToken.balanceOf(tokenTimelock.address);
    expect(balanceContract).to.be.equal(0);
  });
});
