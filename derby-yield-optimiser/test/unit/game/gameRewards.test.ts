import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { parseEther } from '@testhelp/helpers';
import { setupGame } from './setup';

describe('Testing Game Rewards', async () => {
  const chainIds: BigNumberish[] = [10, 100, 1000];

  it('Calculate rewards during rebalance Basket', async function () {
    const { game, derbyToken, vault, user, vaultNumber, basketId } = await setupGame();

    let allocations = [
      [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
      [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
    ];
    const totalAllocations = parseEther('1000');

    /*
     Setup negative rewards
    */

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId, allocations);

    // This rebalance should be skipped for the basket
    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [2_000, 1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [-2_000, -1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [-2_000, -1_000, 500, 100, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [-4_000, -2_000, 1_000, 200, 100]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.connect(user).rebalanceBasket(basketId, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    expect(rewards).to.be.equal(-1_080_000);

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [parseEther('-200'), 0, 0, parseEther('-200'), 0], // 400
      [parseEther('-100'), 0, parseEther('-200'), parseEther('-100'), parseEther('-200')], // 600
    ];

    // user should get allocation of 1k tokens back minus the negativeReward * 50%
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, newAllocations),
    ).to.changeTokenBalance(derbyToken, user, parseEther('1000').sub(1_080_000 * 0.5));

    // unredeemedRewards should be 0
    rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    expect(rewards).to.be.equal(0);

    // Vault should receive the tokens off; negativeRewards * factor of 50%
    const balance = await derbyToken.balanceOf(vault.address);
    expect(balance).to.be.equal(1_080_000 * 0.5);
  });

  it('Should settle negative rewards when negative reward are higher then unlocked tokens', async function () {
    const { game, derbyToken, vault, user, vaultNumber, basketId } = await setupGame();

    let allocations = [
      [parseEther('200'), parseEther('0'), parseEther('0'), parseEther('200'), parseEther('0')], // 400
      [parseEther('100'), parseEther('0'), parseEther('200'), parseEther('100'), parseEther('200')], // 600
    ];
    const totalAllocations = parseEther('1000');

    /*
     Setup negative rewards
    */

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      await game.mockRewards(vaultNumber, chainIds[0], [1, 1, 1, 1, 1]),
      await game.mockRewards(vaultNumber, chainIds[1], [1, 1, 1, 1, 1]),
    ]);

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId, allocations);

    // This rebalance should be skipped for the basket
    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [0, 0, 0, 1000, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-1'), 0, 0, 0, 0]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseEther('-5'), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-5'), 0, 0, 0, 0]),
    ]);

    await game.upRebalancingPeriod(vaultNumber);
    await Promise.all([
      game.mockRewards(vaultNumber, chainIds[0], [parseEther('-5'), 0, 0, 0, 0]),
      game.mockRewards(vaultNumber, chainIds[1], [parseEther('-5'), 0, 0, 0, 0]),
    ]);

    const emptyAllocations = [
      [0, 0, 0, 0, 0], // 400
      [0, 0, 0, 0, 0], // 600
    ];
    await game.connect(user).rebalanceBasket(basketId, emptyAllocations);

    // simulating negative rewards
    let rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    expect(rewards).to.be.equal(parseEther('-3000'));

    /*
     settle negative rewards when withdrawing all allocations
    */

    const newAllocations = [
      [0, 0, 0, 0, 0],
      [parseEther('-100'), 0, 0, 0, 0],
    ];

    // user should 0 tokens back, cause they are all burned (higher negative rewards then unlockedTokens)
    await expect(() =>
      game.connect(user).rebalanceBasket(basketId, newAllocations),
    ).to.changeTokenBalance(derbyToken, user, parseEther('0'));

    // unredeemedRewards should be -3000 + (100 / 0,5)
    // 100 tokens unlocked / burned at factor of 0,5
    rewards = await game.connect(user).basketUnredeemedRewards(basketId);
    expect(rewards).to.be.equal(parseEther('-2800'));

    // Vault should receive all the unlocked tokens
    const balance = await derbyToken.balanceOf(vault.address);
    expect(balance).to.be.equal(parseEther('100'));
  });
});
