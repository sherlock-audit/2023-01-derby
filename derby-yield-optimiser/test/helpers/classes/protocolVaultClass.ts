import { BigNumber, Signer, utils } from 'ethers';
import { Result } from 'ethers/lib/utils';
import { Controller, GameMock, MainVaultMock } from '@typechain';

export interface IProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  chainId: number;
}

export class ProtocolVault {
  name: string;
  protocolToken: string;
  underlyingToken: string;
  govToken: string;
  decimals: number;
  chainId: number;
  number: number = 0;
  allocation: number = 0;
  expectedBalance: number = 0;
  expectedReward: number = 0;
  price: BigNumber = utils.parseEther('0');
  reward: BigNumber = utils.parseEther('0');
  scale: number;

  constructor({
    name,
    protocolToken,
    underlyingToken,
    govToken,
    decimals,
    chainId,
  }: IProtocolVault) {
    this.name = name;
    this.protocolToken = protocolToken;
    this.underlyingToken = underlyingToken;
    this.govToken = govToken;
    this.decimals = decimals;
    this.chainId = chainId;
    this.scale = 10 ** decimals;
  }

  setExpectedBalance(balance: number) {
    this.expectedBalance = balance;
    return this;
  }
  setExpectedReward(reward: number) {
    this.expectedReward = reward;
    return this;
  }

  setPrice(price: BigNumber) {
    this.price = price;
    return this;
  }

  setReward(reward: BigNumber) {
    this.reward = reward;
  }

  async setDeltaAllocation(vault: MainVaultMock, allocation: number): Promise<void> {
    this.allocation += allocation;
    await vault.setDeltaAllocations(this.number, allocation);
  }

  async setDeltaAllocationsWithGame(
    game: GameMock,
    vaultAddr: string,
    allocation: number,
  ): Promise<void> {
    this.allocation += allocation;
    await game.setDeltaAllocations(vaultAddr, this.number, allocation);
  }

  async setCurrentAllocation(vault: MainVaultMock, allocation: number): Promise<void> {
    this.allocation = allocation;
    await vault.setCurrentAllocation(this.number, allocation);
  }

  async getDeltaAllocationTEST(vault: MainVaultMock): Promise<number> {
    const allocation = await vault.getDeltaAllocationTEST(this.number);
    return allocation.toNumber();
  }

  async getAllocation(vault: MainVaultMock): Promise<BigNumber> {
    return await vault.getAllocationTEST(this.number);
  }

  async balanceUnderlying(vault: MainVaultMock): Promise<BigNumber> {
    return await vault.balanceUnderlying(this.number);
  }

  async calcShares(vault: MainVaultMock, amount: BigNumber): Promise<BigNumber> {
    return await vault.calcShares(this.number, amount);
  }

  async balanceShares(vault: MainVaultMock, address: string): Promise<BigNumber> {
    return await vault.balanceSharesTEST(this.number, address);
  }

  async resetAllocation(vault: MainVaultMock) {
    this.allocation = 0;
    await vault.resetDeltaAllocations(this.number);
  }

  async addProtocolToController(
    controller: Controller,
    dao: Signer,
    vaultNumber: number,
    allProviders: any,
  ) {
    const tx = await controller
      .connect(dao)
      .addProtocol(
        this.name,
        vaultNumber,
        allProviders.getProviderAddress(this.name),
        this.protocolToken,
        this.underlyingToken,
        this.govToken,
        (10 ** this.decimals).toString(),
      );
    const receipt = await tx.wait();
    const { protocolNumber } = receipt.events![0].args as Result;

    this.number = protocolNumber;
  }
}
