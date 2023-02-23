import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { dai } from '@testhelp/addresses';

const name: string = 'YearnMockDAI2';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const deploySettings = {
    symbol: 'YVM',
    decimals: 18,
    vaultCurrency: dai,
    exchangeRate: ethers.utils.parseEther('1.150'),
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
