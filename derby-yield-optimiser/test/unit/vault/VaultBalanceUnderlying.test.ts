import { expect } from 'chai';
import { Contract } from 'ethers';
import { erc20, formatUSDC, parseUSDC } from '@testhelp/helpers';
import { allProtocols, usdc } from '@testhelp/addresses';
import { formatUnits } from 'ethers/lib/utils';
import { setupVault } from './setup';

// const amount = 5_000_000;0
const amount = Math.floor(Math.random() * 1_000_000) + 1_000_000;
const amountUSDC = parseUSDC(amount.toString());

const getRandomAllocation = () => Math.floor(Math.random() * 100_000) + 100_00;

describe('Testing balanceUnderlying for every single protocol vault', async () => {
  const IUSDc: Contract = erc20(usdc);

  it('Should calc balanceUnderlying for all known protocols correctly', async function () {
    const { vault, user } = await setupVault();
    const liquidityPerc = 10;

    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, getRandomAllocation());
    }

    await vault.connect(user).deposit(amountUSDC, user.address);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.rebalance();

    const totalAllocatedTokens = Number(await vault.totalAllocatedTokens());
    const liquidityVault = (amount * liquidityPerc) / 100; // 10% liq vault

    // get balance underlying for each protocol and compare with expected balance
    // using to.be.closeTo because of the slippage from swapping USDT and DAI
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = formatUSDC(await protocol.balanceUnderlying(vault));
      const expectedBalance =
        (amount - liquidityVault) * (protocol.allocation / totalAllocatedTokens);

      // console.log(`---------------------------`);
      // console.log(protocol.name);
      // console.log({ balanceUnderlying });
      // console.log({ expectedBalance });

      // 1000 margin cause of trading stables
      expect(Number(balanceUnderlying)).to.be.closeTo(expectedBalance, 1000);
    }

    const totalUnderlying = await vault.savedTotalUnderlying();
    const balanceVault = await IUSDc.balanceOf(vault.address);
    const expectedBalanceVault = (amount * liquidityPerc) / 100;

    // 1500 margin over 1m+ underlying cause of trading stables
    expect(Number(formatUSDC(totalUnderlying))).to.be.closeTo(amount - liquidityVault, 1500);
    expect(Number(formatUSDC(balanceVault))).to.be.closeTo(expectedBalanceVault, 20);
  });

  it('Should calc Shares for all known protocols correctly', async function () {
    const { vault, user } = await setupVault();
    // set random allocations for all protocols
    for (const protocol of allProtocols.values()) {
      await protocol.setDeltaAllocation(vault, getRandomAllocation());
    }

    await vault.connect(user).deposit(amountUSDC, user.address);
    await vault.setVaultState(3);
    await vault.setDeltaAllocationsReceivedTEST(true);
    await vault.rebalance();

    // Get balance of LP shares for each protocol vault
    // Compare it with calcShares with the balanceUnderlying, should match up if calculation is correct.
    for (const protocol of allProtocols.values()) {
      const balanceUnderlying = await protocol.balanceUnderlying(vault);
      const balUnderlying = Number(formatUSDC(balanceUnderlying));
      const calculateShares = formatUnits(
        await protocol.calcShares(vault, balanceUnderlying),
        protocol.decimals,
      );
      const balanceShares = formatUnits(
        await protocol.balanceShares(vault, vault.address),
        protocol.decimals,
      );

      expect(Number(calculateShares)).to.be.closeTo(Number(balanceShares), 100);
    }
  });
});
