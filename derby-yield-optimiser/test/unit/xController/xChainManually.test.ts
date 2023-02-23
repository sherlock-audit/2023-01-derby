import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, random } from '@testhelp/helpers';
import type {
  DerbyToken,
  GameMock,
  MainVaultMock,
  XChainControllerMock,
  XProvider,
} from '@typechain';
import XChainControllerMockArtifact from '@artifacts/Mocks/XChainControllerMock.sol/XChainControllerMock.json';
import { usdc } from '@testhelp/addresses';
import { getAndInitXProviders, addVaultsToXController } from '@testhelp/InitialiseContracts';
import { getAllSigners } from '@testhelp/getContracts';
import { setupXChain } from './setup';
import { deployContract } from 'ethereum-waffle';

const deployXChainControllerMock = (
  deployerSign: Signer,
  game: string,
  dao: string,
  guardian: string,
  homeChain: number,
): Promise<XChainControllerMock> => {
  return deployContract(deployerSign, XChainControllerMockArtifact, [
    game,
    dao,
    guardian,
    homeChain,
  ]) as Promise<XChainControllerMock>;
};

const chainIds = [10, 100];

describe('Testing XChainController, unit test for manual execution', async () => {
  let vault1: MainVaultMock,
    vault2: MainVaultMock,
    xChainController: XChainControllerMock,
    xChainControllerDUMMY: XChainControllerMock,
    xProviderMain: XProvider,
    dao: Signer,
    user: Signer,
    userAddr: string,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    derbyToken: DerbyToken,
    game: GameMock,
    vaultNumber: BigNumberish = 10;
  const slippage = 30;
  const relayerFee = 100;

  const setupXChainExtended = deployments.createFixture(async (hre) => {
    const [dao, guardian] = await getAllSigners(hre);
    const addr = dao.address;

    const allXProviders = await getAndInitXProviders(hre, dao, { xController: 100, game: 10 });
    const [xProviderMain, xProviderArbi] = allXProviders;

    const xChainControllerDUMMY = await deployXChainControllerMock(
      dao,
      addr,
      addr,
      guardian.address,
      100,
    );

    await Promise.all([
      xProviderMain.connect(dao).setXController(xChainControllerDUMMY.address),
      xProviderArbi.connect(dao).setXController(xChainControllerDUMMY.address),

      addVaultsToXController(hre, xChainControllerDUMMY, dao, vaultNumber),
      xChainControllerDUMMY.connect(guardian).setChainIds(chainIds),
      xChainControllerDUMMY.connect(dao).setHomeXProvider(xProviderArbi.address),
    ]);

    return xChainControllerDUMMY;
  });

  before(async function () {
    const setup = await setupXChain(chainIds);
    xChainControllerDUMMY = await setupXChainExtended();

    vault1 = setup.vault1;
    vault2 = setup.vault2;
    xProviderMain = setup.xProviderMain;
    game = setup.game;
    xChainController = setup.xChainController;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    user = setup.user;
    guardian = setup.guardian;
    userAddr = await user.getAddress();

    await xChainController.connect(guardian).setChainIds(chainIds);
    await game.connect(guardian).setChainIds(chainIds);
  });

  it('1) Store allocations in Game contract', async function () {
    const basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    const allocationArray = [
      [100 * 1e6, 0, 100 * 1e6, 100 * 1e6, 100 * 1e6], // 400
      [100 * 1e6, 0, 0, 0, 0], // 100
    ];
    const totalAllocations = 500 * 1e6;

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId, allocationArray);

    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
      totalAllocations,
    );
  });

  it('Only be called by Guardian', async function () {
    await expect(vault1.connect(user).setVaultStateGuard(3)).to.be.revertedWith('only Guardian');
    const chainIds = await xChainController.getChainIds();
    for (let chain of chainIds) {
      await expect(
        game.connect(user).setRebalancingState(vaultNumber, chain, true),
      ).to.be.revertedWith('Game: only Guardian');
    }
    await expect(
      xChainController.connect(user).setReadyGuard(vaultNumber, true),
    ).to.be.revertedWith('xController: only Guardian');
  });

  it('Test Guardian setters in xChainController', async function () {
    // sending funds
    let stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(0);
    expect(stages.ready).to.be.equal(false);
    expect(stages.allocationsReceived).to.be.equal(false);
    expect(stages.underlyingReceived).to.be.equal(0);
    expect(stages.fundsReceived).to.be.equal(0);

    await xChainController.connect(guardian).setActiveVaultsGuard(vaultNumber, 5);
    await xChainController.connect(guardian).setReadyGuard(vaultNumber, true);
    await xChainController.connect(guardian).setAllocationsReceivedGuard(vaultNumber, true);
    await xChainController.connect(guardian).setUnderlyingReceivedGuard(vaultNumber, 10);
    await xChainController.connect(guardian).setFundsReceivedGuard(vaultNumber, 15);

    stages = await xChainController.vaultStage(vaultNumber);

    expect(stages.activeVaults).to.be.equal(5);
    expect(stages.ready).to.be.equal(true);
    expect(stages.allocationsReceived).to.be.equal(true);
    expect(stages.underlyingReceived).to.be.equal(10);
    expect(stages.fundsReceived).to.be.equal(15);

    await vault1.connect(guardian).setVaultStateGuard(2);
    expect(await vault1.state()).to.be.equal(2);
    await vault1.connect(guardian).setVaultStateGuard(5);
    expect(await vault1.state()).to.be.equal(5);

    // Reset
    await xChainController.connect(guardian).setActiveVaultsGuard(vaultNumber, 0);
    await vault1.connect(guardian).setVaultStateGuard(0);
  });

  it('Step 1: Game pushes totalDeltaAllocations to xChainController', async function () {
    // Setting a dummy Controller here so transactions later succeeds but doesnt arrive in the correct Controller
    // Will be corrected by the guardian
    await xChainControllerDUMMY.connect(dao).setGuardian(await guardian.getAddress());
    await xChainControllerDUMMY.connect(guardian).resetVaultStagesDao(vaultNumber);
    await xChainController.connect(guardian).resetVaultStagesDao(vaultNumber);

    // Should emit event with the allocations from above
    await expect(game.pushAllocationsToController(vaultNumber))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [400 * 1e6, 100 * 1e6]);

    // Allocations in xChainController should still be 0 cause of the Dummy
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(0);

    await xChainController
      .connect(guardian)
      .receiveAllocationsFromGameGuard(vaultNumber, [400 * 1e6, 100 * 1e6]);

    // Checking if allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(
      500 * 1e6,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(
      400 * 1e6,
    );

    // perform step 1.5 manually
    await xChainControllerDUMMY.sendFeedbackToVault(vaultNumber, chainIds[0]);
    await xChainControllerDUMMY.sendFeedbackToVault(vaultNumber, chainIds[1]);
  });

  it('Step 2: Vaults push totalUnderlying, totalSupply and totalWithdrawalRequests to xChainController', async function () {
    await vault1.connect(user).deposit(400_000 * 1e6, userAddr);
    await vault2.connect(user).deposit(1000 * 1e6, userAddr);

    await expect(vault1.pushTotalUnderlyingToController())
      .to.emit(vault1, 'PushTotalUnderlying')
      .withArgs(vaultNumber, 10, 400_000 * 1e6, 400_000 * 1e6, 0);

    await expect(vault2.pushTotalUnderlyingToController())
      .to.emit(vault2, 'PushTotalUnderlying')
      .withArgs(vaultNumber, 100, 1000 * 1e6, 1000 * 1e6, 0);

    // should have been send to DUMMY so this should be 0
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(0);

    // Guardian calls manually
    await Promise.all([
      xChainController
        .connect(guardian)
        .setTotalUnderlyingGuard(vaultNumber, 10, 400_000 * 1e6, 400_000 * 1e6, 0),
      xChainController
        .connect(guardian)
        .setTotalUnderlyingGuard(vaultNumber, 100, 1000 * 1e6, 1000 * 1e6, 0),
    ]);

    expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(
      401_000 * 1e6,
    );
    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(401_000 * 1e6);
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 10)).to.be.equal(
      400_000 * 1e6,
    );
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 100)).to.be.equal(
      1000 * 1e6,
    );
  });

  it('Step 3: xChainController pushes exchangeRate amount to send X Chain', async function () {
    const expectedAmounts = [400_000 - (400 / 500) * 401_000, 0];

    // Sending values to dummy vaults
    const chainIds = await xChainControllerDUMMY.getChainIds();

    await expect(
      xChainControllerDUMMY.pushVaultAmounts(vaultNumber, chainIds[0], {
        value: ethers.utils.parseEther('0.1'),
      }),
    )
      .to.emit(xChainControllerDUMMY, 'SendXChainAmount')
      .withArgs(vault1.address, 10, expectedAmounts[0] * 1e6, 1 * 1e6, false);

    expect(formatUSDC(await vault1.amountToSendXChain())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.amountToSendXChain())).to.be.equal(expectedAmounts[1]);

    // Test guardian function
    await vault1.connect(guardian).setXChainAllocationGuard(2000, 1.5 * 1e6, false);
    await vault2.connect(guardian).setXChainAllocationGuard(1000, 1.5 * 1e6, true);

    expect(await vault1.amountToSendXChain()).to.be.equal(2000);
    expect(await vault2.amountToSendXChain()).to.be.equal(1000);
    expect(await vault1.exchangeRate()).to.be.equal(1.5 * 1e6);
    expect(await vault2.exchangeRate()).to.be.equal(1.5 * 1e6);

    // set state back for next step
    await vault1
      .connect(guardian)
      .setXChainAllocationGuard(expectedAmounts[0] * 1e6, 1 * 1e6, false);
    await vault2.connect(guardian).setXChainAllocationGuard(0, 1 * 1e6, true);
  });

  it('Step 4: Push funds from vaults to xChainControlle', async function () {
    await vault1.rebalanceXChain(slippage, relayerFee, { value: ethers.utils.parseEther('0.1') });
    await expect(
      vault2.rebalanceXChain(slippage, relayerFee, { value: ethers.utils.parseEther('0.1') }),
    ).to.be.revertedWith('Wrong state');

    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);
    // Manually up funds received because feedback is sent to DUMMY controller
    await xChainController.connect(guardian).setFundsReceivedGuard(vaultNumber, 2);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(2);
  });

  it('Step 5: Push funds from xChainController to vaults', async function () {
    expect(await vault2.state()).to.be.equal(3);
    // Manually receiving funds (funds it self or not actually received)
    await vault2.connect(guardian).receiveFundsGuard();

    expect(await vault1.state()).to.be.equal(4);
    expect(await vault2.state()).to.be.equal(4);
  });

  it('Step 6: Game pushes deltaAllocations to vaults', async function () {
    const allocationArray = [100 * 1e6, 0, 200 * 1e6, 300 * 1e6, 400 * 1e6];

    // Manually setting protcol allocations
    await vault1.connect(guardian).receiveProtocolAllocationsGuard(allocationArray);

    for (let i = 0; i < allocationArray.length; i++) {
      expect(await vault1.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[i]);
    }

    expect(await vault1.deltaAllocationsReceived()).to.be.true;
  });

  it('Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    await game.connect(guardian).upRebalancingPeriod(vaultNumber);

    const vault1Rewards = [1 * 1e6, 0, 2 * 1e6, 3 * 1e6, 4 * 1e6];
    const vault2Rewards = [0, 0, 0, 6 * 1e6, 7 * 1e6];

    await game.connect(guardian).settleRewardsGuard(vaultNumber, 10, vault1Rewards);
    await game.connect(guardian).settleRewardsGuard(vaultNumber, 100, vault2Rewards);

    for (let i = 0; i < vault1Rewards.length; i++) {
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, 10, 2, i)).to.be.equal(
        vault1Rewards[i],
      );
      expect(await game.getRewardsPerLockedTokenTEST(vaultNumber, 100, 2, i)).to.be.equal(
        vault2Rewards[i],
      );
    }
  });

  it('Both Game and Vault should revert when rebalance not needed', async function () {
    // set very high interval so a rebalance is not needed
    await vault1.connect(guardian).setRebalanceInterval(100_000);
    await game.connect(dao).setRebalanceInterval(100_000);

    await expect(vault1.pushTotalUnderlyingToController()).to.be.revertedWith('Rebalancing');
    await expect(game.pushAllocationsToController(vaultNumber)).to.be.revertedWith(
      'No rebalance needed',
    );
  });

  it('Guardian sendFundsToXController to send funds back when xCall fails', async function () {
    await IUSDc.connect(user).transfer(xProviderMain.address, 10_000);

    await expect(xProviderMain.connect(guardian).sendFundsToXController(usdc)).to.be.revertedWith(
      'No xController on this chain',
    );

    await xProviderMain.connect(dao).setXControllerChainId(10);

    await expect(() =>
      xProviderMain.connect(guardian).sendFundsToXController(usdc),
    ).to.changeTokenBalance(IUSDc, xChainControllerDUMMY, 10_000);
  });

  it('Guardian sendFundsToVault to send funds back when xCall fails', async function () {
    const vaultNumber = random(100);

    await expect(
      xProviderMain.connect(guardian).sendFundsToVault(vaultNumber, usdc),
    ).to.be.revertedWith('Zero address');

    await IUSDc.connect(user).transfer(xProviderMain.address, 10_000);
    await xProviderMain.connect(dao).setVaultAddress(vaultNumber, vault1.address);

    await expect(() =>
      xProviderMain.connect(guardian).sendFundsToVault(vaultNumber, usdc),
    ).to.changeTokenBalance(IUSDc, vault1, 10_000);
  });
});
