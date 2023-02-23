import { network } from 'hardhat';
import { expect } from 'chai';
import { Contract } from 'ethers';
import { Result } from 'ethers/lib/utils';
import {
  erc20,
  formatUnits,
  formatUSDC,
  getUSDCSigner,
  getWhale,
  parseUnits,
  parseUSDC,
} from '@testhelp/helpers';
import {
  usdc,
  dai,
  compToken,
  CompWhale,
  compound_dai_01,
  aave_usdt_01,
  yearn_usdc_01,
  aave_usdc_01,
  compound_usdc_01,
} from '@testhelp/addresses';
import { ProtocolVault } from '@testhelp/classes/protocolVaultClass';
import { setupVault } from './setup';

describe('Testing VaultSwap, unit test', async () => {
  const IUSDc: Contract = erc20(usdc),
    IDAI: Contract = erc20(dai),
    IComp: Contract = erc20(compToken);

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

  it('Claim function in vault should claim COMP and sell for more then minAmountOut in USDC', async function () {
    const { vault, user } = await setupVault();
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 60),
      aaveVault.setDeltaAllocation(vault, 0),
      yearnVault.setDeltaAllocation(vault, 0),
    ]);

    const amountToDeposit = parseUSDC('100000');

    // Deposit and rebalance with 100k in only Compound
    await vault.connect(user).deposit(amountToDeposit, user.address);
    await vault.setVaultState(3);
    await vault.rebalance();
    // mine 100 blocks to gain COMP Tokens
    for (let i = 0; i <= 100; i++) await network.provider.send('evm_mine');

    const USDCBalanceBeforeClaim = await IUSDc.balanceOf(vault.address);
    await vault.claimTokens();
    const USDCBalanceAfterClaim = await IUSDc.balanceOf(vault.address);

    const USDCReceived = USDCBalanceAfterClaim.sub(USDCBalanceBeforeClaim);
    // console.log(`USDC Received ${USDCReceived}`);

    expect(Number(USDCBalanceAfterClaim)).to.be.greaterThan(Number(USDCBalanceBeforeClaim));
  });

  it('Swapping COMP to USDC and calc minAmountOut with swapTokensMulti', async function () {
    const { vault, user } = await setupVault();
    const compSigner = await getWhale(CompWhale);
    const swapAmount = parseUnits('100', 18); // 1000 comp tokens
    await IComp.connect(compSigner).transfer(vault.address, swapAmount);

    let compBalance = await IComp.balanceOf(vault.address);
    let usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(compBalance).to.be.equal(swapAmount);
    expect(usdcBalance).to.be.equal(0);

    const tx = await vault.swapMinAmountOutMultiTest(swapAmount, compToken, usdc);
    const receipt = await tx.wait();
    const { minAmountOut } = receipt.events!.at(-1)!.args as Result;

    await vault.swapTokensMultiTest(swapAmount, compToken, usdc, false);
    compBalance = await IComp.balanceOf(vault.address);
    usdcBalance = await IUSDc.balanceOf(vault.address);

    expect(usdcBalance).to.be.equal(minAmountOut);
    expect(compBalance).to.be.equal(0);
  });

  it('Swapping USDC to COMP and COMP back to USDC', async function () {
    const { vault, user } = await setupVault();
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vault.address, swapAmount);
    const usdcBalance = await IUSDc.balanceOf(vault.address);
    // console.log(`USDC Balance vault: ${usdcBalance}`);

    await vault.swapTokensMultiTest(swapAmount, usdc, compToken, false);

    const compBalance = await IComp.balanceOf(vault.address);
    // console.log(`Comp Balance vault: ${compBalance}`);

    // Atleast receive some COMP
    expect(formatUnits(compBalance, 18)).to.be.greaterThan(0);
    await vault.swapTokensMultiTest(compBalance, compToken, usdc, false);

    // console.log(`USDC Balance vault End: ${await IUSDc.balanceOf(vault.address)}`);
    const compBalanceEnd = await IComp.balanceOf(vault.address);
    const usdcBalanceEnd = await IUSDc.balanceOf(vault.address);

    // MultiHop swap fee is 0,6% => total fee = +- 1,2% => 10_000 * 1,2% = 120 fee
    expect(Number(formatUSDC(usdcBalanceEnd))).to.be.closeTo(10_000 - 120, 25);
    expect(compBalanceEnd).to.be.equal(0);
  });

  it('Curve Stable coin swap USDC to DAI', async function () {
    const { vault, user } = await setupVault();
    const swapAmount = parseUSDC('10000');
    await IUSDc.connect(user).transfer(vault.address, swapAmount);

    // USDC Balance vault
    const usdcBalance = await IUSDc.balanceOf(vault.address);
    // console.log(`USDC Balance vault: ${formatUSDC(usdcBalance)}`);

    // Curve swap USDC to DAI
    await vault.curveSwapTest(swapAmount, usdc, dai);

    // DAI Balance vault
    const daiBalance = await IDAI.balanceOf(vault.address);
    // console.log(`Dai Balance vault: ${formatUnits(daiBalance, 18)}`);

    // Expect DAI received to be 10_000 - fee
    expect(Number(formatUnits(daiBalance, 18))).to.be.closeTo(10_000, 5);
  });

  it('Should add CompoundDAI and AaveUSDT to vault and Swap on deposit/withdraw', async function () {
    const { vault, user } = await setupVault();
    for (const protocol of protocols.values()) await protocol.resetAllocation(vault);

    const amount = 1_000_000;
    const amountUSDC = parseUSDC(amount.toString());

    await vault.setDeltaAllocationsReceivedTEST(true);

    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 20),
      aaveVault.setDeltaAllocation(vault, 0),
      yearnVault.setDeltaAllocation(vault, 0),
      compoundDAIVault.setDeltaAllocation(vault, 40),
      aaveUSDTVault.setDeltaAllocation(vault, 40),
    ]);

    // Deposit and rebalance with 100k
    await vault.connect(user).deposit(amountUSDC, user.address);
    await vault.setVaultState(3);
    await vault.rebalance();

    let totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    let balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    // console.log(`USDC Balance vault: ${balanceVault}`);

    // Check if balanceInProtocol ===
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance =
        (amount - balanceVault) * (protocol.allocation / totalAllocatedTokens);

      // console.log(`---------------------------`);
      // console.log(protocol.name);
      // console.log(protocol.number);
      // console.log(protocol.allocation);
      // console.log({ totalAllocatedTokens });
      // console.log({ balanceUnderlying });
      // console.log({ expectedBalance });

      // margin for trading slightly unstable stables
      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 700);
    }

    // console.log('----------- Rebalance AaveUSDT to 0, compoundDAI to 10 -----------');
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 20),
      aaveVault.setDeltaAllocation(vault, 0),
      yearnVault.setDeltaAllocation(vault, 0),
      compoundDAIVault.setDeltaAllocation(vault, -30),
      aaveUSDTVault.setDeltaAllocation(vault, -40),
    ]);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);

    await vault.rebalance();

    totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    // console.log(`USDC Balance vault: ${balanceVault}`);

    // Check if balanceInProtocol ===
    // currentAllocation / totalAllocated * ( amountDeposited - balanceVault - gasUsed)
    for (const protocol of protocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance =
        (amount - balanceVault) * (protocol.allocation / totalAllocatedTokens);

      // console.log(`---------------------------`);
      // console.log(protocol.name);
      // console.log(protocol.number);
      // console.log(protocol.allocation);
      // console.log({ totalAllocatedTokens });
      // console.log({ balanceUnderlying });
      // console.log({ expectedBalance });

      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 400);
    }
  });

  it('Should always have some liquidity to pay for Rebalance fee', async function () {
    const { vault, user, dao } = await setupVault();
    for (const protocol of protocols.values()) await protocol.resetAllocation(vault);

    const gasFeeLiquidity = 10_000;
    const amountToDeposit = parseUSDC('100000');
    let amountToWithdraw = parseUSDC('50000');

    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, 40),
      aaveVault.setDeltaAllocation(vault, 60),
      yearnVault.setDeltaAllocation(vault, 20),
    ]);

    // Deposit and rebalance with 100k
    await vault.connect(user).deposit(amountToDeposit, user.address);
    await vault.setVaultState(3);

    await vault.rebalance();

    let balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    let USDCBalanceUser = await IUSDc.balanceOf(user.address);
    // console.log({ gasUsed });
    // console.log(USDCBalanceUser);

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity);

    // console.log('-----------------withdraw 50k-----------------');
    await vault.setDeltaAllocationsReceivedTEST(true);
    await Promise.all([
      compoundVault.setDeltaAllocation(vault, -40),
      aaveVault.setDeltaAllocation(vault, -60),
      yearnVault.setDeltaAllocation(vault, 120),
    ]);

    await vault.connect(dao).setVaultState(0);
    await vault.connect(user).deposit(amountToWithdraw, user.address);
    await vault.connect(user).withdraw(amountToWithdraw, user.address, user.address);
    await vault.setVaultState(3);
    await vault.rebalance();

    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    USDCBalanceUser = await IUSDc.balanceOf(user.address);
    // console.log({ gasUsed });
    // console.log(USDCBalanceUser);

    expect(Number(balanceVault)).to.be.greaterThanOrEqual(gasFeeLiquidity);

    // console.log('-----------------withdraw another 42k = 92k total-----------------');
    amountToWithdraw = parseUSDC('42000');
    await vault.connect(dao).setVaultState(0);
    await vault.connect(user).deposit(amountToWithdraw, user.address);
    await vault.connect(user).withdraw(amountToWithdraw, user.address, user.address);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.setVaultState(3);
    await vault.rebalance();

    balanceVault = formatUSDC(await IUSDc.balanceOf(vault.address));
    USDCBalanceUser = await IUSDc.balanceOf(user.address);
    // console.log({ gasUsed });
    // console.log(USDCBalanceUser);

    // 3 times gas for rebalances
    expect(Number(balanceVault)).to.be.greaterThanOrEqual(100_000 - 92_000);
  });

  it('Should take into account token balance first', async function () {
    const { vault } = await setupVault();
    const compSigner = await getWhale(CompWhale);
    const USDCSigner = await getUSDCSigner();

    const compAmount = parseUnits('1000', 18); // 1000 comp tokens
    const swapAmount = parseUSDC('10000'); // 100 comp tokens

    // transfer comp and usdc to vault
    await Promise.all([
      IComp.connect(compSigner).transfer(vault.address, compAmount),
      IUSDc.connect(USDCSigner).transfer(vault.address, swapAmount),
    ]);

    // should use token balance in the vault instead of swapping, so balance should not change
    const compBalanceBefore = await IComp.balanceOf(vault.address);
    const usdcBalanceBefore = await IUSDc.balanceOf(vault.address);
    await vault.swapTokensMultiTest(swapAmount, usdc, compToken, true);
    const compBalanceAfter = await IComp.balanceOf(vault.address);
    const usdcBalanceAfter = await IUSDc.balanceOf(vault.address);

    expect(compBalanceAfter - compBalanceBefore).to.be.equal(0);
    expect(usdcBalanceAfter - usdcBalanceBefore).to.be.equal(0);
  });
});
