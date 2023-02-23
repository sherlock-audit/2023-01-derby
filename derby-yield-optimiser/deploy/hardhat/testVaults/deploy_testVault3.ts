import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigVault } from '@testhelp/deployHelpers';

const vaultName = 'TestVault3';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  const deployConfig = await getDeployConfigVault(vaultName, network.name);
  if (!deployConfig) throw 'Unknown contract name';

  const { name, symbol, decimals, vaultNumber, vaultCurrency, uScale } = deployConfig;

  const swapLibrary = await deployments.get('Swap');
  const game = await deployments.get('GameMock');
  const controller = await deployments.get('Controller');

  await deploy(vaultName, {
    from: deployer,
    contract: 'MainVaultMock',
    args: [
      name,
      symbol,
      decimals,
      vaultNumber,
      dao,
      game.address,
      controller.address,
      vaultCurrency,
      uScale,
    ],
    libraries: {
      Swap: swapLibrary.address,
    },
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = [vaultName];
func.dependencies = ['Swap', 'Controller', 'GameMock'];
