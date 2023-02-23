import { expect } from 'chai';
import { Signer, Contract, BigNumberish } from 'ethers';
import { erc20, formatUSDC, parseDRB, parseEther, parseUnits, parseUSDC } from '@testhelp/helpers';
import type { Controller, DerbyToken, GameMock, XChainControllerMock } from '@typechain';
import { usdc } from '@testhelp/addresses';
import { setupIntegration } from './setup';
import { IGameUser, IChainId, mintBasket, IVaultUser, IVaults, IUnderlyingVault } from './helpers';
import { ethers } from 'hardhat';

describe('Testing full integration test', async () => {
  const slippage = 30;
  const relayerFee = 100;

  let vaultNumber: BigNumberish = 10,
    guardian: Signer,
    IUSDc: Contract = erc20(usdc),
    vaults: IVaults[],
    underlyingVaults: IUnderlyingVault[],
    xChainController: XChainControllerMock,
    controller: Controller,
    game: GameMock,
    derbyToken: DerbyToken,
    vaultUsers: IVaultUser[],
    gameUsers: IGameUser[],
    exchangeRate: number,
    chains: IChainId[];

  before(async function () {
    const setup = await setupIntegration();
    game = setup.game;
    xChainController = setup.xChainController;
    controller = setup.controller;
    derbyToken = setup.derbyToken;
    guardian = setup.guardian;

    chains = [
      {
        id: 10,
        totalAllocations: 3000, // * 10^18 (DRB tokens)
      },
      {
        id: 100,
        totalAllocations: 6000, // * 10^18 (DRB tokens)
      },
    ];

    vaultUsers = [
      {
        user: setup.users[0],
        chain: 10,
        vault: setup.vaults[0],
        depositAmount: parseUSDC(10_000),
      },
      {
        user: setup.users[1],
        chain: 10,
        vault: setup.vaults[0],
        depositAmount: parseUSDC(100_000),
      },
      {
        user: setup.users[2],
        chain: 100,
        vault: setup.vaults[1],
        depositAmount: parseUSDC(1_000_000),
      },
    ];

    vaults = [
      {
        // expected stats based on vaultUsers deposits
        vault: setup.vaults[0],
        homeChain: 10,
        underlying: parseUSDC(110_000),
        totalSupply: parseUnits(110_000, 6),
        totalWithdrawalRequests: 0,
      },
      {
        // expected stats based on vaultUsers deposits
        vault: setup.vaults[1],
        homeChain: 100,
        underlying: parseUSDC(1_000_000),
        totalSupply: parseUnits(1_000_000, 6),
        totalWithdrawalRequests: 0,
      },
    ];

    gameUsers = [
      {
        user: setup.gameUsers[0],
        basketId: 0,
        allocations: [
          [parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100), parseDRB(100)],
          [parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200), parseDRB(200)],
        ],
        totalAllocations: 1500, // * 10^18
      },
      {
        user: setup.gameUsers[1],
        basketId: 1,
        allocations: [
          [parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500), parseDRB(500)],
          [parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000), parseDRB(1_000)],
        ],
        totalAllocations: 7500, // * 10^18
      },
    ];

    underlyingVaults = [
      {
        name: 'YearnMockUSDC1',
        vault: setup.underlyingVaults[0],
        price: parseUnits(1.02, 6),
      },
      {
        name: 'YearnMockUSDC2',
        vault: setup.underlyingVaults[1],
        price: parseUnits(1.05, 6),
      },
      {
        name: 'YearnMockDAI1',
        vault: setup.underlyingVaults[2],
        price: parseUnits(1.1, 18),
      },
      {
        name: 'YearnMockDAI2',
        vault: setup.underlyingVaults[3],
        price: parseUnits(1.15, 18),
      },
      {
        name: 'YearnMockUSDT',
        vault: setup.underlyingVaults[4],
        price: parseUnits(1.2, 6),
      },
    ];
  });

  describe('Create and rebalance basket for 2 game users', async function () {
    it('Rebalance basket allocation array for both game users', async function () {
      for (const { basketId, user, totalAllocations, allocations } of gameUsers) {
        await mintBasket(game, user, vaultNumber);

        await derbyToken.connect(user).increaseAllowance(game.address, parseDRB(totalAllocations));

        await expect(() =>
          game.connect(user).rebalanceBasket(basketId, allocations),
        ).to.changeTokenBalance(derbyToken, user, parseDRB(-totalAllocations));

        expect(await game.connect(user).basketTotalAllocatedTokens(basketId)).to.be.equal(
          parseDRB(totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in baskets', async function () {
      // loops through allocations arrays from both baskets
      for (const { user, basketId, allocations } of gameUsers) {
        for (let i = 0; i < allocations[0].length; i++) {
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, chains[0].id, i),
          ).to.be.equal(allocations[0][i]);
          expect(
            await game.connect(user).basketAllocationInProtocol(basketId, chains[1].id, i),
          ).to.be.equal(allocations[1][i]);
        }
      }
    });

    it('Should set chain allocations correctly in game contract', async function () {
      for (const chain of chains) {
        expect(await game.getDeltaAllocationChain(vaultNumber, chain.id)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });

    it('Should set protocol allocations correctly in game contract', async function () {
      // basket allocation arrays added together
      const expectedAllocations = [
        [parseDRB(600), parseDRB(600), parseDRB(600), parseDRB(600), parseDRB(600)],
        [parseDRB(1200), parseDRB(1200), parseDRB(1200), parseDRB(1200), parseDRB(1200)],
      ];
      for (let i = 0; i < expectedAllocations[0].length; i++) {
        expect(await game.getDeltaAllocationProtocol(vaultNumber, chains[0].id, i)).to.be.equal(
          expectedAllocations[0][i],
        );
        expect(await game.getDeltaAllocationProtocol(vaultNumber, chains[1].id, i)).to.be.equal(
          expectedAllocations[1][i],
        );
      }
    });

    it('Game contract should have derbyTokens locked', async function () {
      expect(await derbyToken.balanceOf(game.address)).to.be.equal(
        parseDRB(gameUsers[0].totalAllocations + gameUsers[1].totalAllocations),
      );
    });
  });

  describe('Deposit funds in vaults', async function () {
    it('Deposit funds in vault 1 and 2 for all 3 vault users', async function () {
      for (const { user, vault, depositAmount } of vaultUsers) {
        const expectedLPTokens = depositAmount; // exchangeRate is 1
        const userAddr = await user.getAddress();

        await expect(() =>
          vault.connect(user).deposit(depositAmount, userAddr),
        ).to.changeTokenBalance(vault, user, expectedLPTokens);
      }
    });
  });

  describe('Rebalance Step 1: Game pushes allocations to controller', async function () {
    it('Trigger should emit PushedAllocationsToController event', async function () {
      // should be done for every new vaultNumber deployed
      await xChainController.connect(guardian).resetVaultStagesDao(vaultNumber);

      await expect(game.pushAllocationsToController(vaultNumber, { value: parseEther('0.1') }))
        .to.emit(game, 'PushedAllocationsToController')
        .withArgs(vaultNumber, [
          parseDRB(chains[0].totalAllocations),
          parseDRB(chains[1].totalAllocations),
        ]);

      // perform step 1.5 manually
      await xChainController.sendFeedbackToVault(vaultNumber, chains[0].id);
      await xChainController.sendFeedbackToVault(vaultNumber, chains[1].id);
    });

    it('Should have moved delta allocations from game to xChainController', async function () {
      for (const chain of chains) {
        expect(await game.getDeltaAllocationChain(vaultNumber, chain.id)).to.be.equal(0);
        expect(await xChainController.getCurrentAllocationTEST(vaultNumber, chain.id)).to.be.equal(
          parseDRB(chain.totalAllocations),
        );
      }
    });
  });

  describe('Rebalance Step 2: Trigger vaults to push totalUnderlyings', async function () {
    it('Trigger should emit PushTotalUnderlying event', async function () {
      for (const { vault, homeChain, underlying, totalSupply, totalWithdrawalRequests } of vaults) {
        await expect(vault.pushTotalUnderlyingToController({ value: parseEther('0.1') }))
          .to.emit(vault, 'PushTotalUnderlying')
          .withArgs(vaultNumber, homeChain, underlying, totalSupply, totalWithdrawalRequests);
      }
    });

    it('Should set totalUnderlying correctly in xChainController', async function () {
      for (const { homeChain, underlying } of vaults) {
        expect(
          await xChainController.getTotalUnderlyingOnChainTEST(vaultNumber, homeChain),
        ).to.be.equal(underlying);
      }

      expect(await xChainController.getTotalUnderlyingVaultTEST(vaultNumber)).to.be.equal(
        parseUSDC(1_110_000), // 1m + 110k
      );
    });
  });

  describe('Rebalance Step 3: xChainController pushes exchangeRate and amount to vaults', async function () {
    const exchangeRate = 1e6;

    // setting expected amountToSend
    before(function () {
      vaults[0].amountToSend = parseUSDC(0); // will receive 260k
      vaults[1].amountToSend = parseUSDC(1_000_000 - (6000 / 9000) * 1_110_000); // = 260k
    });

    it('Trigger should emit SendXChainAmount event', async function () {
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[0].id, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[0].vault.address,
          chains[0].id,
          vaults[0].amountToSend,
          exchangeRate,
          true,
        );
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[1].id, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[1].vault.address,
          chains[1].id,
          vaults[1].amountToSend,
          exchangeRate,
          false,
        );
    });

    it('Should set amount to deposit or withdraw in vault', async function () {
      for (const { vault, amountToSend } of vaults) {
        expect(await vault.amountToSendXChain()).to.be.equal(amountToSend);
        expect(await vault.exchangeRate()).to.be.equal(exchangeRate);
      }
    });

    it('Should correctly set states', async function () {
      expect(await vaults[0].vault.state()).to.be.equal(3); // dont have to send any funds
      expect(await vaults[1].vault.state()).to.be.equal(2);
    });
  });

  describe('Rebalance Step 4: Vaults push funds to xChainController', async function () {
    const vaultCurrency = usdc;
    const balanceVault1 = parseUSDC(1_000_000 - 260_000); // expected => balance - amountToSend

    it('Vault 0 should revert because they will receive funds', async function () {
      await expect(
        vaults[0].vault.rebalanceXChain(slippage, relayerFee, {
          value: parseEther('0.1'),
        }),
      ).to.be.revertedWith('Wrong state');
    });

    it('Trigger should emit RebalanceXChain event', async function () {
      await expect(
        vaults[1].vault.rebalanceXChain(slippage, relayerFee, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(vaults[1].vault, 'RebalanceXChain')
        .withArgs(vaultNumber, vaults[1].amountToSend, vaultCurrency);
    });

    it('xChainController should have received funds ', async function () {
      expect(await IUSDc.balanceOf(xChainController.address)).to.be.equal(vaults[1].amountToSend);
      expect(await IUSDc.balanceOf(vaults[0].vault.address)).to.be.equal(vaults[0].underlying); // 110k
      expect(await IUSDc.balanceOf(vaults[1].vault.address)).to.be.equal(balanceVault1); // 200k - 68k

      // 2 vaults
      expect(await xChainController.getFundsReceivedState(vaultNumber)).to.be.equal(2);
    });

    it('Should correctly set states', async function () {
      expect(await vaults[0].vault.state()).to.be.equal(3); // dont have to send any funds
      expect(await vaults[1].vault.state()).to.be.equal(4);
    });
  });

  describe('Rebalance Step 5: xChainController push funds to vaults', async function () {
    const underlying = usdc;

    // expected vault balances after rebalance
    before(function () {
      vaults[0].newUnderlying = (3000 / 9000) * 1_110_000; // vault 0 = 370k
      vaults[1].newUnderlying = (6000 / 9000) * 1_110_000; // vault 1 = 740k
    });

    it('Trigger should emit SentFundsToVault event', async function () {
      // only vault 0 will receive funds
      await expect(
        xChainController.sendFundsToVault(vaultNumber, slippage, chains[0].id, relayerFee, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SentFundsToVault')
        .withArgs(vaults[0].vault.address, chains[0].id, vaults[1].amountToSend, underlying);
      // we have to try for each chain id
      await xChainController.sendFundsToVault(vaultNumber, slippage, chains[1].id, relayerFee, {
        value: parseEther('0.1'),
      });
    });

    it('Vaults should have received all the funds', async function () {
      expect(await IUSDc.balanceOf(xChainController.address)).to.be.equal(0);
      for (const { vault, newUnderlying } of vaults) {
        expect(await vault.getVaultBalance()).to.be.equal(parseUSDC(newUnderlying!));
        expect(await vault.getVaultBalance()).to.be.equal(parseUSDC(newUnderlying!));
      }
    });

    it('Should correctly set states', async function () {
      expect(await vaults[0].vault.state()).to.be.equal(4);
      expect(await vaults[1].vault.state()).to.be.equal(4);
    });
  });

  describe('Rebalance Step 6: Game pushes deltaAllocations to vaults', async function () {
    // total expected chain allocatioons
    before(function () {
      vaults[0].chainAllocs = [
        parseDRB(600),
        parseDRB(600),
        parseDRB(600),
        parseDRB(600),
        parseDRB(600),
      ];
      vaults[1].chainAllocs = [
        parseDRB(1200),
        parseDRB(1200),
        parseDRB(1200),
        parseDRB(1200),
        parseDRB(1200),
      ];
    });

    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[0].homeChain, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, vaults[0].chainAllocs);
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[1].homeChain, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, vaults[1].chainAllocs);
    });

    it('Should set protocol allocations in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      // looping through expected chain allocations set above for both vaults and compare them
      for (const { vault, chainAllocs } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          expect(await vault.getDeltaAllocationTEST(i)).to.be.equal(chainAllocs![i]);
        }
      }
    });

    it('Should set deltaAllocationsReceived to true in vaults', async function () {
      for (const { vault } of vaults) {
        expect(await vault.deltaAllocationsReceived()).to.be.true;
      }
    });
  });

  describe('Rebalance Step 7: Vaults rebalance', async function () {
    // expectedProtocolBalance = (allocation / totalAllocations) * totalUnderlying
    before(function () {
      vaults[0].expectedProtocolBalance = (600 / 3000) * vaults[0].newUnderlying!;
      vaults[1].expectedProtocolBalance = (1200 / 6000) * vaults[1].newUnderlying!;
    });

    it('Trigger rebalance vaults', async function () {
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });

    it('Check savedTotalUnderlying in vaults', async function () {
      for (const { vault, newUnderlying } of vaults) {
        expect(formatUSDC(await vault.savedTotalUnderlying())).to.be.closeTo(newUnderlying, 100);
      }
    });

    it('Check balance for every protocol in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      for (const { vault, expectedProtocolBalance } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          // closeTo because of the stable coin swapping in the vault
          expect(formatUSDC(await vault.balanceUnderlying(i))).to.be.closeTo(
            expectedProtocolBalance,
            100,
          );
        }
      }
    });

    it('Should correctly set states', async function () {
      expect(await vaults[0].vault.state()).to.be.equal(5);
      expect(await vaults[1].vault.state()).to.be.equal(5);
    });
  });

  describe('Rebalance Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    before(function () {
      // set expectedRewards
      vaults[0].rewards = [0, 0, 0, 0, 0];
      vaults[1].rewards = [0, 0, 0, 0, 0];
    });

    it('Trigger should emit PushedRewardsToGame event', async function () {
      for (const { vault, homeChain, rewards } of vaults) {
        await expect(vault.sendRewardsToGame({ value: parseEther('0.1') }))
          .to.emit(vault, 'PushedRewardsToGame')
          .withArgs(vaultNumber, homeChain, rewards);
      }
    });

    it('Check rewards for every protocolId', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 1;

      for (let i = 0; i < Number(id); i++) {
        // rewards are 0 because it is the first rebalance
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[0].id, rebalancingPeriod, i),
        ).to.be.equal(0);
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[1].id, rebalancingPeriod, i),
        ).to.be.equal(0);
      }
    });

    it('Should correctly set states', async function () {
      expect(await vaults[0].vault.state()).to.be.equal(0);
      expect(await vaults[1].vault.state()).to.be.equal(0);
    });
  });

  describe('Rebalance 2 Step 1: Increasing exchangeRates to simulate returns in vaults', async function () {
    before(async function () {
      underlyingVaults[0].price = parseUnits(1.04, 6);
      underlyingVaults[1].price = parseUnits(1.1, 6);
      underlyingVaults[2].price = parseUnits(1.15, 18);
      underlyingVaults[3].price = parseUnits(1.16, 18);
      underlyingVaults[4].price = parseUnits(1.22, 6);
      for (const { vault, price } of underlyingVaults) {
        await vault.setExchangeRate(price);
        expect(await vault.exchangeRate()).to.be.equal(price);
      }
    });

    it('Rebalance Step 1: 0 deltas', async function () {
      await expect(game.pushAllocationsToController(vaultNumber, { value: parseEther('0.1') }))
        .to.emit(game, 'PushedAllocationsToController')
        .withArgs(vaultNumber, [0, 0]);
    });
  });

  describe('Rebalance 2 Step 2: Vault underlyings should have increased', async function () {
    before(function () {
      // cause of the yearn mock vaults price increase
      vaults[0].newUnderlying = 380245.289596; // old 370k
      vaults[1].newUnderlying = 760488.93982; // old 740k
    });

    it('Trigger should emit PushTotalUnderlying event', async function () {
      for (const { vault, homeChain, newUnderlying, totalSupply } of vaults) {
        await expect(vault.pushTotalUnderlyingToController({ value: parseEther('0.1') }))
          .to.emit(vault, 'PushTotalUnderlying')
          .withArgs(vaultNumber, homeChain, parseUSDC(newUnderlying!), totalSupply, 0);
      }
    });
  });

  describe('Rebalance 2 Step 3: xChainController pushes exchangeRate and amount to vaults', async function () {
    // expected exchangeRate
    const exchangeRate = 1_027_688; // 1.027688

    // setting expected amountToSend
    before(function () {
      vaults[0].amountToSend = parseUSDC(0);
      vaults[1].amountToSend = parseUSDC(0);
    });

    it('Trigger should emit SendXChainAmount event', async function () {
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[0].id, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[0].vault.address,
          chains[0].id,
          vaults[0].amountToSend,
          exchangeRate,
          false,
        );
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[1].id, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[1].vault.address,
          chains[1].id,
          vaults[1].amountToSend,
          exchangeRate,
          false,
        );
    });
  });

  describe('Rebalance 2 Step 4: Vaults push funds to xChainController', async function () {
    const vaultCurrency = usdc;

    it('Vault 0 should revert because they will receive funds', async function () {
      await expect(
        vaults[0].vault.rebalanceXChain(slippage, relayerFee, {
          value: parseEther('0.1'),
        }),
      ).to.be.revertedWith('Wrong state');
      await expect(
        vaults[1].vault.rebalanceXChain(slippage, relayerFee, {
          value: parseEther('0.1'),
        }),
      ).to.be.revertedWith('Wrong state');
    });
  });

  describe('Rebalance 2 Step 5: xChainController push funds to vaults', async function () {
    const underlying = usdc;
    const amountToReceiveVault1 = 0;

    before(function () {
      vaults[0].chainAllocs = [0, 0, 0, 0, 0];
      vaults[1].chainAllocs = [0, 0, 0, 0, 0];
    });

    it('Trigger should emit SentFundsToVault event', async function () {
      // both vaults wont receive funds
      await xChainController.sendFundsToVault(vaultNumber, slippage, chains[1].id, relayerFee, {
        value: parseEther('0.1'),
      });

      // we have to try for each chain id
      await xChainController.sendFundsToVault(vaultNumber, slippage, chains[0].id, relayerFee, {
        value: parseEther('0.1'),
      });
    });
  });

  describe('Rebalance 2 Step 6: Game pushes deltaAllocations to vaults', async function () {
    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[0].homeChain, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, vaults[0].chainAllocs);
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[1].homeChain, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, vaults[1].chainAllocs);
    });
  });

  describe('Rebalance 2 Step 7: Vaults rebalance', async function () {
    // expectedProtocolBalance = (allocation / totalAllocations) * totalUnderlying

    it('Trigger rebalance vaults', async function () {
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });
  });

  describe('Rebalance 2 Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    before(function () {
      // set expectedRewards
      vaults[0].rewards = [248_526, 603_563, 576_129, 110_216, 211_247];
      vaults[1].rewards = [248_525, 603_562, 576_127, 110_215, 211_246];
    });

    it('Trigger should emit PushedRewardsToGame event', async function () {
      for (const { vault, homeChain, rewards } of vaults) {
        await expect(vault.sendRewardsToGame({ value: parseEther('0.1') }))
          .to.emit(vault, 'PushedRewardsToGame')
          .withArgs(vaultNumber, homeChain, rewards);
      }
    });

    it('Check rewards for every protocolId', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 2;

      for (let i = 0; i < Number(id); i++) {
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[0].id, rebalancingPeriod, i),
        ).to.be.equal(vaults[0].rewards![i]);
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[1].id, rebalancingPeriod, i),
        ).to.be.equal(vaults[1].rewards![i]);
      }
    });
  });

  describe('Game user 0 rebalance to all zero for rewards', async function () {
    // rewardsPerLockedToken * allocations
    const expectedRewardsVault1 =
      248_526 * 100 + 603_563 * 100 + 576_129 * 100 + 110_216 * 100 + 211_247 * 100;
    const expectedRewardsVault2 =
      248_525 * 200 + 603_562 * 200 + 576_127 * 200 + 110_215 * 200 + 211_246 * 200;
    const totalExpectedRewards = expectedRewardsVault1 + expectedRewardsVault2;

    before(function () {
      gameUsers[0].allocations = [
        [parseDRB(-100), parseDRB(-100), parseDRB(-100), parseDRB(-100), parseDRB(-100)],
        [parseDRB(-200), parseDRB(-200), parseDRB(-200), parseDRB(-200), parseDRB(-200)],
      ];
      vaults[0].totalWithdrawalRequests = totalExpectedRewards;
    });

    it('Rebalance basket should give unredeemedRewards', async function () {
      const { user, basketId, allocations } = gameUsers[0];

      await game.connect(user).rebalanceBasket(basketId, allocations);
      expect(await game.connect(user).basketUnredeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
    });

    it('Should redeem rewards a.k.a set withdrawalRequest in vault', async function () {
      const { user, basketId } = gameUsers[0];
      await game.connect(user).redeemRewards(basketId);

      expect(await game.connect(user).basketRedeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vaults[0].vault.getRewardAllowanceTEST(user.address)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vaults[0].vault.getTotalWithdrawalRequestsTEST()).to.be.equal(
        totalExpectedRewards,
      );
    });

    it('Should not be able to withdraw rewards from vault before next rebalance', async function () {
      const { user } = gameUsers[0];
      await expect(vaults[0].vault.connect(user).withdrawRewards()).to.be.revertedWith('!Funds');
    });
  });

  describe('Set withdrawal requests', async function () {
    exchangeRate = 1_027_688; // 1.027688

    it('Vault 0 (user 0): Should set withdrawal request for all LP tokens (10k)', async function () {
      const { user, vault } = vaultUsers[0];
      const initialDeposit = 10_000;
      const expectedUserUSDCBalance = initialDeposit * exchangeRate;

      const userBalance = await vault.balanceOf(user.address);

      expect(userBalance).to.be.equal(parseUSDC(initialDeposit));
      await expect(() => vault.connect(user).withdrawalRequest(userBalance)).to.changeTokenBalance(
        vault,
        user,
        parseUSDC(-initialDeposit),
      );
      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(
        expectedUserUSDCBalance,
      );
    });

    it('Vault 2 (user 2): Should set withdrawal request for LP tokens (500k)', async function () {
      const { user, vault } = vaultUsers[2];
      const withdrawAmount = 500_000;
      const expectedUserUSDCBalance = withdrawAmount * exchangeRate;

      await expect(() =>
        vault.connect(user).withdrawalRequest(parseUSDC(withdrawAmount)),
      ).to.changeTokenBalance(vault, user, parseUSDC(-withdrawAmount));

      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(
        expectedUserUSDCBalance,
      );
    });
  });

  describe('Rebalance 3 Step 1: Increasing exchangeRates to simulate returns in vaults', async function () {
    it('Rebalance Step 1: game user 0 left the game with -500 and -1000 allocations', async function () {
      await expect(game.pushAllocationsToController(vaultNumber, { value: parseEther('0.1') }))
        .to.emit(game, 'PushedAllocationsToController')
        .withArgs(vaultNumber, [parseDRB(-500), parseDRB(-1000)]);
    });
  });

  describe('Rebalance 3 Step 2: Vault underlyings should have increased', async function () {
    before(function () {
      vaults[0].newUnderlying = 380245.014117; //
      vaults[0].totalSupply = parseUnits(110_000 - 10_000, 6); // 10k User withdraw
      vaults[0].totalWithdrawalRequests =
        Number(vaults[0].totalWithdrawalRequests) + 10_000 * exchangeRate; // 10k User withdraw

      vaults[1].newUnderlying = 760489.381537; //
      vaults[1].totalSupply = parseUnits(1_000_000 - 500_000, 6); // 500k User withdraw
      vaults[1].totalWithdrawalRequests = 500_000 * exchangeRate; // 500k User withdraw
    });

    it('Trigger should emit PushTotalUnderlying event', async function () {
      for (const {
        vault,
        homeChain,
        newUnderlying,
        totalSupply,
        totalWithdrawalRequests,
      } of vaults) {
        await expect(vault.pushTotalUnderlyingToController({ value: parseEther('0.1') }))
          .to.emit(vault, 'PushTotalUnderlying')
          .withArgs(
            vaultNumber,
            homeChain,
            parseUSDC(newUnderlying!),
            totalSupply,
            totalWithdrawalRequests,
          );
      }
    });
  });

  describe('Rebalance 3 Step 3: xChainController pushes exchangeRate and amount to vaults', async function () {
    before(function () {
      exchangeRate = 1_026_814; // dropped slightly cause of the rewards
      vaults[0].amountToSend = parseUSDC(164080.360166);
      vaults[1].amountToSend = parseUSDC(0);
    });

    it('Trigger should emit SendXChainAmount event', async function () {
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[0].id, { value: parseEther('0.1') }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[0].vault.address,
          chains[0].id,
          vaults[0].amountToSend,
          exchangeRate,
          false,
        );
      await expect(
        xChainController.pushVaultAmounts(vaultNumber, chains[1].id, {
          value: parseEther('0.1'),
        }),
      )
        .to.emit(xChainController, 'SendXChainAmount')
        .withArgs(
          vaults[1].vault.address,
          chains[1].id,
          vaults[1].amountToSend,
          exchangeRate,
          true,
        );
    });
  });

  describe('Rebalance 3 Step 4: Vaults push funds to xChainController', async function () {
    const vaultCurrency = usdc;

    before(function () {
      vaults[0].amountToSend = parseUSDC(164079.593746);
      vaults[1].amountToSend = parseUSDC(0);
    });

    it('Vault 0 should revert because they will receive funds', async function () {
      await expect(
        vaults[1].vault.rebalanceXChain(slippage, relayerFee, {
          value: ethers.utils.parseEther('0.1'),
        }),
      ).to.be.revertedWith('Wrong state');
    });

    it('Trigger should emit RebalanceXChain event', async function () {
      await expect(
        vaults[0].vault.rebalanceXChain(slippage, relayerFee, {
          value: ethers.utils.parseEther('0.1'),
        }),
      )
        .to.emit(vaults[0].vault, 'RebalanceXChain')
        .withArgs(vaultNumber, vaults[0].amountToSend, vaultCurrency);
    });
  });

  describe('Rebalance 3 Step 5: xChainController push funds to vaults', async function () {
    const underlying = usdc;

    it('Trigger should emit SentFundsToVault event', async function () {
      // only vault 1 will receive funds
      await xChainController.sendFundsToVault(vaultNumber, slippage, chains[1].id, relayerFee, {
        value: ethers.utils.parseEther('0.1'),
      });

      // we have to try for each chain id
      await xChainController.sendFundsToVault(vaultNumber, slippage, chains[0].id, relayerFee, {
        value: ethers.utils.parseEther('0.1'),
      });
      // await expect(xChainController.sendFundsToVault(vaultNumber))
      //   .to.emit(xChainController, 'SentFundsToVault')
      //   .withArgs(vaults[1].vault.address, chains[1].id, amountToReceiveVault1, underlying);

      expect(await IUSDc.balanceOf(vaults[1].vault.address)).to.be.equal(vaults[0].amountToSend);
    });
  });

  describe('Rebalance 3 Step 6: Game pushes deltaAllocations to vaults', async function () {
    before(function () {
      // game user 0 went to all 0 allocations
      vaults[0].chainAllocs = [
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
        parseDRB(-100),
      ];
      vaults[1].chainAllocs = [
        parseDRB(-200),
        parseDRB(-200),
        parseDRB(-200),
        parseDRB(-200),
        parseDRB(-200),
      ];
    });

    it('Trigger should emit PushProtocolAllocations event', async function () {
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[0].homeChain, {
          value: ethers.utils.parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[0].homeChain, vaults[0].vault.address, vaults[0].chainAllocs);
      await expect(
        game.pushAllocationsToVaults(vaultNumber, vaults[1].homeChain, {
          value: ethers.utils.parseEther('0.1'),
        }),
      )
        .to.emit(game, 'PushProtocolAllocations')
        .withArgs(vaults[1].homeChain, vaults[1].vault.address, vaults[1].chainAllocs);
    });
  });

  describe('Rebalance 3 Step 7: Vaults rebalance', async function () {
    // totalUnderlying = oldUnderlying - withdrawalRequests
    // expectedProtocolBalance = (allocation / totalAllocations) * totalUnderlying
    before(function () {
      const newTotalUnderlying =
        vaults[0].newUnderlying! -
        Number(vaults[0].totalWithdrawalRequests) / 1e6 +
        vaults[1].newUnderlying! -
        Number(vaults[1].totalWithdrawalRequests) / 1e6;

      vaults[0].newUnderlying = (2500 / 7500) * newTotalUnderlying;
      vaults[0].expectedProtocolBalance = (500 / 2500) * vaults[0].newUnderlying!;

      vaults[1].newUnderlying = (5000 / 7500) * newTotalUnderlying;
      vaults[1].expectedProtocolBalance = (1000 / 5000) * vaults[1].newUnderlying!;
    });

    it('Trigger rebalance vaults', async function () {
      for (const { vault } of vaults) {
        await vault.rebalance();
      }
    });

    it('Check balance for every protocol in vaults', async function () {
      const id = await controller.latestProtocolId(vaultNumber);

      for (const { vault, expectedProtocolBalance } of vaults) {
        for (let i = 0; i < Number(id); i++) {
          // closeTo because of the stable coin swapping in the vault
          expect(formatUSDC(await vault.balanceUnderlying(i))).to.be.closeTo(
            expectedProtocolBalance,
            100,
          );
        }
      }
    });
  });

  describe('Rebalance 3 Step 8: Vaults push rewardsPerLockedToken to game', async function () {
    it('Trigger should emit PushedRewardsToGame event', async function () {
      // 0 rewards made
      const rewards = [0, 0, 0, 0, 0];

      for (const { vault, homeChain } of vaults) {
        await expect(vault.sendRewardsToGame({ value: ethers.utils.parseEther('0.1') }))
          .to.emit(vault, 'PushedRewardsToGame')
          .withArgs(vaultNumber, homeChain, rewards);
      }
    });

    it('Rewards should be the same because they are accumulated', async function () {
      const id = await controller.latestProtocolId(vaultNumber);
      const rebalancingPeriod = 3;

      for (let i = 0; i < Number(id); i++) {
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[0].id, rebalancingPeriod, i),
        ).to.be.equal(vaults[0].rewards![i]);
        expect(
          await game.getRewardsPerLockedTokenTEST(vaultNumber, chains[1].id, rebalancingPeriod, i),
        ).to.be.equal(vaults[1].rewards![i]);
      }
    });
  });

  describe('Redeem withdraw allowance for users to receive funds', async function () {
    before(function () {
      exchangeRate = 1_027_688; // Created allowance with old exchangeRate
    });

    it('Vault 0 (user 0): Withdraw allowance', async function () {
      const { user, vault } = vaultUsers[0];
      const initialDeposit = 10_000;
      const expectedUserUSDCBalance = initialDeposit * exchangeRate;

      expect(await vault.connect(user).balanceOf(user.address)).to.be.equal(0);
      await expect(() => vault.connect(user).withdrawAllowance()).to.changeTokenBalance(
        IUSDc,
        user,
        expectedUserUSDCBalance,
      );
      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(0);
    });

    it('Vault 2 (user 2): Withdraw allowance', async function () {
      const { user, vault } = vaultUsers[2];
      const withdrawAmount = 500_000;
      const expectedUserUSDCBalance = withdrawAmount * exchangeRate;

      const balanceBefore = formatUSDC(await IUSDc.balanceOf(user.address));
      await vault.connect(user).withdrawAllowance();
      const balanceAfter = formatUSDC(await IUSDc.balanceOf(user.address));

      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedUserUSDCBalance / 1e6, 5);

      expect(await vault.connect(user).getWithdrawalAllowance()).to.be.equal(0);
    });

    it('Should redeem rewards for game user 0', async function () {
      const expectedRewardsVault1 =
        248_526 * 100 + 603_563 * 100 + 576_129 * 100 + 110_216 * 100 + 211_247 * 100;
      const expectedRewardsVault2 =
        248_525 * 200 + 603_562 * 200 + 576_127 * 200 + 110_215 * 200 + 211_246 * 200;
      const totalExpectedRewards = expectedRewardsVault1 + expectedRewardsVault2;

      const { user, basketId } = gameUsers[0];
      const { vault } = vaults[0];

      const balanceBefore = formatUSDC(await IUSDc.balanceOf(user.address));
      await vault.connect(user).withdrawRewards();
      const balanceAfter = formatUSDC(await IUSDc.balanceOf(user.address));

      expect(balanceAfter - balanceBefore).to.be.closeTo(totalExpectedRewards / 1e6, 5);

      expect(await game.connect(user).basketRedeemedRewards(basketId)).to.be.equal(
        totalExpectedRewards,
      );
      expect(await vault.getRewardAllowanceTEST(user.address)).to.be.equal(0);
      expect(await vault.getTotalWithdrawalRequestsTEST()).to.be.equal(0);
    });
  });
});
