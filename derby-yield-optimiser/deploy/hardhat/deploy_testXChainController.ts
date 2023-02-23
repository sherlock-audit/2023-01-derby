import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getDeployConfigXController } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao, guardian } = await getNamedAccounts();

  const deployConfig = await getDeployConfigXController(network.name);
  if (!deployConfig) throw 'Unknown contract name';

  const { homeChainId } = deployConfig;

  const game = await deployments.get('GameMock');

  await deploy('XChainControllerMock', {
    from: deployer,
    args: [game.address, dao, guardian, homeChainId],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['XChainControllerMock'];
func.dependencies = ['GameMock'];
