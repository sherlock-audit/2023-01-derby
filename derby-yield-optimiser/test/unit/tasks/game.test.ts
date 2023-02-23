import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { GameMock } from '@typechain';
import { getInitConfigGame } from '@testhelp/deployHelpers';

describe('Testing game tasks', () => {
  const setupGame = deployments.createFixture(async ({ deployments, ethers, network }) => {
    await deployments.fixture(['GameMock']);
    const deployment = await deployments.get('GameMock');
    const game: GameMock = await ethers.getContractAt('GameMock', deployment.address);

    const gameConfig = await getInitConfigGame(network.name);
    if (!gameConfig) throw 'Unknown contract name';

    const dummyProvider = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    await run('game_init', { provider: dummyProvider, homevault: dummyProvider });

    return { game, gameConfig };
  });

  const random = (max: number) => Math.floor(Math.random() * max);

  it('game_mint_basket', async function () {
    await setupGame();
    const vaultnumber = random(100);

    const basketId = await run('game_mint_basket', { vaultnumber });
    const basketId1 = await run('game_mint_basket', { vaultnumber });
    expect(basketId).to.be.equal(0);
    expect(basketId1).to.be.equal(1);
  });

  /*************
  Only Guardian
  **************/

  it('game_set_vault_address', async function () {
    const { game } = await setupGame();
    const vault = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const chainid = random(10_000);
    const vaultnumber = random(100);

    await run('game_set_vault_address', { vaultnumber, chainid, address: vault });
    expect(await game.getVaultAddressTest(vaultnumber, chainid)).to.be.equal(vault);
  });

  it('game_latest_protocol_id', async function () {
    const { game } = await setupGame();
    const chainid = random(10_000);
    const latestprotocolid = random(100);

    await run('game_latest_protocol_id', { chainid, latestprotocolid });
    expect(await game.latestProtocolId(chainid)).to.be.equal(latestprotocolid);
  });

  it('game_set_chain_ids', async function () {
    const { game } = await setupGame();
    const chainids = [
      random(1000),
      random(1000),
      random(1000),
      random(1000),
      random(1000),
      random(1000),
    ];

    await run('game_set_chain_ids', { chainids });
    expect(await game.getChainIds()).to.be.deep.equal(chainids);
  });

  it('game_set_rebalancing_state', async function () {
    const { game } = await setupGame();
    const vaultnumber = random(100);
    const state = true;
    const chainIds = await game.getChainIds();
    for (let chain of chainIds) {
      expect(await game.isXChainRebalancing(vaultnumber, chain)).to.be.equal(false);
      await run('game_set_rebalancing_state', { vaultnumber, state });
      expect(await game.isXChainRebalancing(vaultnumber, chain)).to.be.equal(state);
    }
  });

  it('game_settle_rewards_guard', async function () {
    const { game } = await setupGame();
    const rewards = [
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
      random(10_000e6),
    ];
    const vaultnumber = random(100);
    const chainid = random(10_000);
    const period = 1;

    await game.upRebalancingPeriod(vaultnumber);
    await run('game_settle_rewards_guard', { vaultnumber, chainid, rewards });

    const rewardsPromise = rewards.map((reward, i) => {
      return game.getRewardsPerLockedTokenTEST(vaultnumber, chainid, period, i);
    });

    const gameRewards = await Promise.all(rewardsPromise);
    expect(gameRewards).to.be.deep.equal(rewards);
  });

  /*************
  Only Dao
  **************/

  it('game_set_xprovider', async function () {
    const { game } = await setupGame();
    const provider = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

    await run('game_set_xprovider', { provider });
    expect(await game.xProvider()).to.be.equal(provider);
  });

  it('game_set_home_vault', async function () {
    const { game } = await setupGame();
    const vault = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    await run('game_set_home_vault', { vault });
    expect(await game.homeVault()).to.be.equal(vault);
  });

  it('game_set_rebalance_interval', async function () {
    const { game } = await setupGame();
    const rebalanceInterval = random(100_000_000);

    await run('game_set_rebalance_interval', { timestamp: rebalanceInterval });
    expect(await game.rebalanceInterval()).to.be.equal(rebalanceInterval);
  });

  it('game_set_dao', async function () {
    const { game } = await setupGame();
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';

    await run('game_set_dao', { address: dao });
    expect(await game.getDao()).to.be.equal(dao);
  });

  it('game_set_guardian', async function () {
    const { game } = await setupGame();
    const guardian = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

    await run('game_set_guardian', { guardian });
    expect(await game.getGuardian()).to.be.equal(guardian);
  });

  it('game_set_derby_token', async function () {
    const { game } = await setupGame();
    const derbyToken = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    await run('game_set_derby_token', { token: derbyToken });
    expect(await game.derbyToken()).to.be.equal(derbyToken);
  });

  it('game_set_negative_reward_threshold', async function () {
    const { game, gameConfig } = await setupGame();
    const { negativeRewardThreshold } = gameConfig;

    await run('game_set_negative_reward_threshold', { threshold: negativeRewardThreshold });
    expect(await game.getNegativeRewardThreshold()).to.be.equal(negativeRewardThreshold);
  });

  it('game_set_negative_reward_factor', async function () {
    const { game, gameConfig } = await setupGame();
    const { negativeRewardFactor } = gameConfig;

    await run('game_set_negative_reward_factor', { factor: negativeRewardFactor });
    expect(await game.getNegativeRewardFactor()).to.be.equal(negativeRewardFactor);
  });

  it('game_set_rebalancing_period', async function () {
    const { game } = await setupGame();
    const vaultnumber = random(1000);
    const period = random(1000);

    await run('game_set_rebalancing_period', { vaultnumber, period });
    expect(await game.getRebalancingPeriod(vaultnumber)).to.be.equal(period);
  });
});
