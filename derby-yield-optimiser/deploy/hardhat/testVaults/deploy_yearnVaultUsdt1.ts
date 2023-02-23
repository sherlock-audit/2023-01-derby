import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { usdt } from '@testhelp/addresses';

const name: string = 'YearnMockUSDT1';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    symbol: 'YVM',
    decimals: 6,
    vaultCurrency: usdt,
    exchangeRate: 1200000,
  };
  const { symbol, decimals, vaultCurrency, exchangeRate } = deploySettings;

  await deploy(name, {
    from: deployer,
    contract: 'YearnVaultMock',
    args: [name, symbol, decimals, vaultCurrency, exchangeRate],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = [name];
func.dependencies = [];
