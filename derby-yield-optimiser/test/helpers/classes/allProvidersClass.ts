import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Deployment } from 'hardhat-deploy/types';

class AllProviders {
  yearnProvider!: Deployment;
  compoundProvider!: Deployment;
  aaveProvider!: Deployment;
  truefiProvider!: Deployment;
  idleProvider!: Deployment;
  betaProvider!: Deployment;

  async setProviders({ deployments }: HardhatRuntimeEnvironment): Promise<any> {
    [
      this.yearnProvider,
      this.compoundProvider,
      this.aaveProvider,
      this.truefiProvider,
      this.idleProvider,
      this.betaProvider,
    ] = await Promise.all([
      deployments.get('YearnProvider'),
      deployments.get('CompoundProvider'),
      deployments.get('AaveProvider'),
      deployments.get('TruefiProvider'),
      deployments.get('IdleProvider'),
      deployments.get('BetaProvider'),
    ]);
  }

  getProviderAddress(name: string) {
    if (name.includes('yearn')) return this.yearnProvider.address;
    if (name.includes('compound')) return this.compoundProvider.address;
    if (name.includes('aave')) return this.aaveProvider.address;
    if (name.includes('truefi')) return this.truefiProvider.address;
    if (name.includes('beta')) return this.betaProvider.address;
    if (name.includes('idle')) return this.idleProvider.address;
    else return 'none';
  }
}

export default new AllProviders();
