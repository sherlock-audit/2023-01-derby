import { MockContract } from '@ethereum-waffle/mock-contract';
import { Signer } from 'ethers';
import {
  deployAaveProviderMock,
  deployCompoundProviderMock,
  deployYearnProviderMock,
} from '../deployMocks';

class AllMockProviders {
  yearnProvider!: MockContract;
  compoundProvider!: MockContract;
  aaveProvider!: MockContract;

  async deployAllMockProviders(dao: Signer): Promise<void> {
    [this.yearnProvider, this.compoundProvider, this.aaveProvider] = await Promise.all([
      deployYearnProviderMock(dao),
      deployCompoundProviderMock(dao),
      deployAaveProviderMock(dao),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    if (name.includes('aave')) return this.aaveProvider.address;
    else return 'none';
  }
}

export default new AllMockProviders();
