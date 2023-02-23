import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigXProvider } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const deployConfig = await getDeployConfigXProvider(network.name);
  if (!deployConfig) throw 'Unknown contract name';
  const { optimism } = deployConfig;

  const game = await deployments.get('GameMock');
  const xChainController = await deployments.get('XChainControllerMock');
  const connext = await deployments.get('ConnextMock');

  await deploy('XProviderOpti', {
    from: deployer,
    contract: 'XProvider',
    args: [
      connext.address,
      dao,
      guardian,
      game.address,
      xChainController.address,
      optimism,
    ],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XProviderOpti'];
func.dependencies = ['GameMock', 'XChainControllerMock', 'ConnextMock'];
