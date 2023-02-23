import { run } from 'hardhat';
import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseEther } from '@testhelp/helpers';
import type { DerbyToken, GameMock, MainVaultMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupXChain } from './setup';

const chainIds = [10, 100, 1000, 10000];

describe('Testing XChainController, integration test', async () => {
  let vaultNumber: BigNumberish = 10,
    basketId: BigNumberish,
    vault1: MainVaultMock,
    vault2: MainVaultMock,
    vault3: MainVaultMock,
    vault4: MainVaultMock,
    xChainController: XChainControllerMock,
    dao: Signer,
    guardian: Signer,
    user: Signer,
    IUSDc: Contract = erc20(usdc),
    derbyToken: DerbyToken,
    game: GameMock,
    userAddr: string;
  const slippage = 30;
  const relayerFee = 100;

  before(async function () {
    const setup = await setupXChain();
    vault1 = setup.vault1;
    vault2 = setup.vault2;
    vault3 = setup.vault3;
    vault4 = setup.vault4;
    game = setup.game;
    xChainController = setup.xChainController;
    derbyToken = setup.derbyToken;
    dao = setup.dao;
    guardian = setup.guardian;
    user = setup.user;
    userAddr = await user.getAddress();
  });

  it('1) Store allocations in Game contract', async function () {
    basketId = await run('game_mint_basket', { vaultnumber: vaultNumber });

    const allocationArray = [
      [200, 0, 0, 198, 0], // 400
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
      [2, 0, 0, 0, 0], // 10
    ];
    const totalAllocations = 2000;

    await derbyToken.connect(user).increaseAllowance(game.address, totalAllocations);
    await game.connect(user).rebalanceBasket(basketId, allocationArray);

    expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
      totalAllocations,
    );

    // looping through all of allocationArray
    allocationArray.forEach(async (chainIdArray, i) => {
      for (let j = 0; j < chainIdArray.length; j++) {
        expect(
          await game.connect(user).basketAllocationInProtocol(basketId, chainIds[i], j),
        ).to.be.equal(chainIdArray[j]);
      }
    });
  });

  it('1.5) Store vault stages', async function () {
    await xChainController.setActiveVaultsTEST(vaultNumber, 1);

    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(false);

    await xChainController.setReadyTEST(vaultNumber, true);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);

    await xChainController.setAllocationsReceivedTEST(vaultNumber, true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(true);

    await xChainController.upUnderlyingReceivedTEST(vaultNumber);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(1);

    await xChainController.resetVaultStagesTEST(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    expect(await xChainController.getAllocationState(vaultNumber)).to.be.equal(false);
    expect(await xChainController.getUnderlyingState(vaultNumber)).to.be.equal(0);
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(0);

    // chainId on or off
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 10)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 100)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 1000)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 10000)).to.be.false;
  });

  it('2) Game pushes delta allocations to xChainController', async function () {
    await xChainController.connect(guardian).resetVaultStagesDao(vaultNumber);
    expect(await xChainController.getVaultReadyState(vaultNumber)).to.be.equal(true);
    // chainIds = [10, 100, 1000, 2000];
    await expect(game.pushAllocationsToController(vaultNumber, { value: parseEther('0.1') }))
      .to.emit(game, 'PushedAllocationsToController')
      .withArgs(vaultNumber, [398, 600, 1000]);

    // checking of allocations are correctly set in xChainController
    expect(await xChainController.getCurrentTotalAllocationTEST(vaultNumber)).to.be.equal(2000);
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[0])).to.be.equal(
      398,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[1])).to.be.equal(
      600,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[2])).to.be.equal(
      1000,
    );
    expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chainIds[3])).to.be.equal(
      2,
    );

    // perform step 1.5 manually
    await xChainController.sendFeedbackToVault(vaultNumber, chainIds[0]);
    await xChainController.sendFeedbackToVault(vaultNumber, chainIds[1]);
    await xChainController.sendFeedbackToVault(vaultNumber, chainIds[2]);
    await xChainController.sendFeedbackToVault(vaultNumber, chainIds[3]);

    // chainId on or off
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 10)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 100)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 1000)).to.be.false;
    expect(await xChainController.getVaultChainIdOff(vaultNumber, 10000)).to.be.false;
  });

  it('3) Trigger vaults to push totalUnderlyings to xChainController', async function () {
    await vault1.connect(user).deposit(100_000 * 1e6, userAddr);
    await vault2.connect(user).deposit(200_000 * 1e6, userAddr);

    await vault2.setExchangeRateTEST(1.2 * 1e6);
    await vault2.connect(user).withdrawalRequest(50_000 * 1e6);

    await vault1.pushTotalUnderlyingToController({ value: parseEther('0.1') });
    await vault2.pushTotalUnderlyingToController({ value: parseEther('0.1') });
    await vault3.pushTotalUnderlyingToController({ value: parseEther('0.1') });
    await vault4.pushTotalUnderlyingToController({ value: parseEther('0.1') });

    expect(await xChainController.getTotalSupplyTEST(vaultNumber)).to.be.equal(250_000 * 1e6);
    expect(await xChainController.getWithdrawalRequestsTEST(vaultNumber, 100)).to.be.equal(
      50_000 * 1.2 * 1e6,
    );
    expect(await xChainController.getTotalWithdrawalRequestsTEST(vaultNumber)).to.be.equal(
      50_000 * 1.2 * 1e6,
    );

    // // Should revert if total Underlying is already set
    await expect(
      vault1.pushTotalUnderlyingToController({ value: parseEther('0.1') }),
    ).to.be.revertedWith('Rebalancing');

    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 10)).to.be.equal(
      100_000 * 1e6,
    );
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 100)).to.be.equal(
      200_000 * 1e6,
    );
    expect(await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, 1000)).to.be.equal(0);

    const totalUnderlying = await xChainController.getTotalUnderlyingVaultTEST(vaultNumber);
    expect(totalUnderlying).to.be.equal(300_000 * 1e6);
  });

  it('4) Calc and set amount to deposit or withdraw in vault', async function () {
    const chainIds = await xChainController.getChainIds();
    for (let chain of chainIds) {
      await xChainController.pushVaultAmounts(vaultNumber, chain, {
        value: parseEther('0.1'),
      });
    }

    // balanceVault - ( allocation * totalUnderlying ) - withdrawRequests
    const expectedAmounts = [
      100_000 - (398 / 2000) * 240_000 - 0, // vault 1 = 52_000
      200_000 - (600 / 2000) * 240_000 - 60_000, // vault 2 = 68_000
      0, // vault 3 = Receiving 120_000
      0, // vault 4
    ];
    const expectedExchangeRate = (240_000 / 250_000) * 1e6; // == 0.96

    expect(formatUSDC(await vault1.amountToSendXChain())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.amountToSendXChain())).to.be.equal(expectedAmounts[1]);
    expect(formatUSDC(await vault3.amountToSendXChain())).to.be.equal(expectedAmounts[2]);
    expect(formatUSDC(await vault4.amountToSendXChain())).to.be.equal(expectedAmounts[3]);

    expect(await vault1.exchangeRate()).to.be.equal(expectedExchangeRate);
    expect(await vault2.exchangeRate()).to.be.equal(expectedExchangeRate);
    expect(await vault3.exchangeRate()).to.be.equal(expectedExchangeRate);

    // Checking if vault states upped correctly
    expect(await vault1.state()).to.be.equal(2);
    expect(await vault2.state()).to.be.equal(2);
    expect(await vault3.state()).to.be.equal(3); // dont have to send any funds
    expect(await vault4.state()).to.be.equal(4); // not reaching cap so should go to rebalanceVault
  });

  it('4.5) Trigger vaults to transfer funds to xChainController', async function () {
    await vault1.rebalanceXChain(slippage, relayerFee, { value: parseEther('0.1') });
    await vault2.rebalanceXChain(slippage, relayerFee, { value: parseEther('0.1') });
    await expect(
      vault3.rebalanceXChain(slippage, relayerFee, { value: parseEther('0.1') }),
    ).to.be.revertedWith('Wrong state');

    // 150k should be sent to xChainController
    expect(await IUSDc.balanceOf(xChainController.address)).to.be.equal((52_000 + 68_240) * 1e6);
    expect(await IUSDc.balanceOf(vault1.address)).to.be.equal(47_760 * 1e6); // 100k - 52k
    expect(await IUSDc.balanceOf(vault2.address)).to.be.equal(132_000 * 1e6); // 200k - 68k
    expect(await IUSDc.balanceOf(vault3.address)).to.be.equal(0);

    expect(await vault1.state()).to.be.equal(4); // should have upped after sending funds
    expect(await vault2.state()).to.be.equal(4); // should have upped after sending funds
    expect(await vault3.state()).to.be.equal(3); // have to receive funds
    expect(await vault4.state()).to.be.equal(4);

    // all 4 vaults are ready
    expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(4);
  });

  it('5) Trigger xChainController to send funds to vaults', async function () {
    const chainIds = await xChainController.getChainIds();
    for (let chain of chainIds) {
      await xChainController.sendFundsToVault(vaultNumber, slippage, chain, relayerFee, {
        value: parseEther('0.1'),
      });
    }

    const expectedAmounts = [
      (398 / 2000) * 240_000, // vault 1
      (600 / 2000) * 240_000 + 60_000, // vault 2 should have the request of 60k
      (1000 / 2000) * 240_000, // vault 3 should have received 150k from controller
    ];

    // reserved funds of vault2 should be 60k at this point
    expect(await vault2.getReservedFundsTEST()).to.be.equal(60_000 * 1e6);
    expect(await vault2.getTotalWithdrawalRequestsTEST()).to.be.equal(0);

    expect(formatUSDC(await IUSDc.balanceOf(vault1.address))).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await IUSDc.balanceOf(vault2.address))).to.be.equal(expectedAmounts[1]);
    expect(formatUSDC(await IUSDc.balanceOf(vault3.address))).to.be.equal(expectedAmounts[2]);

    expect(formatUSDC(await vault1.getVaultBalance())).to.be.equal(expectedAmounts[0]);
    expect(formatUSDC(await vault2.getVaultBalance())).to.be.equal(expectedAmounts[1]);
    expect(formatUSDC(await vault3.getVaultBalance())).to.be.equal(expectedAmounts[2]);

    expect(await vault3.state()).to.be.equal(4); // received funds, all vaults should be ready now
  });

  it('6) Push allocations from game to vaults', async function () {
    const chainIds = await xChainController.getChainIds();
    for (let chain of chainIds) {
      expect(await game.isXChainRebalancing(vaultNumber, chain)).to.be.true;
      await game.pushAllocationsToVaults(vaultNumber, chain, {
        value: parseEther('0.1'),
      });
      expect(await game.isXChainRebalancing(vaultNumber, chain)).to.be.false;
    }

    const allocationArray = [
      [200, 0, 0, 198, 0], // 400
      [100, 0, 200, 100, 200], // 600
      [0, 100, 200, 300, 400], // 1000
      [2, 0, 0, 0, 0], // 0
    ];

    // vault 1
    for (let i = 0; i < allocationArray[0].length; i++) {
      expect(await vault1.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[0][i]);
    }
    for (let i = 0; i < allocationArray[1].length; i++) {
      expect(await vault2.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[1][i]);
    }
    for (let i = 0; i < allocationArray[2].length; i++) {
      expect(await vault3.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[2][i]);
    }
    for (let i = 0; i < allocationArray[3].length; i++) {
      expect(await vault4.getDeltaAllocationTEST(i)).to.be.equal(allocationArray[3][i]);
    }

    expect(await vault1.deltaAllocationsReceived()).to.be.true;
    expect(await vault2.deltaAllocationsReceived()).to.be.true;
    expect(await vault3.deltaAllocationsReceived()).to.be.true;
    expect(await vault4.deltaAllocationsReceived()).to.be.true;
  });

  it('Should correctly set dao address', async function () {
    const userAddr = await user.getAddress();
    await xChainController.connect(dao).setDao(userAddr);
    expect(await xChainController.getDao()).to.be.equal(userAddr);
  });
});
