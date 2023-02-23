import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  run,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  await deploy('Controller', {
    from: deployer,
    contract: 'Controller',
    args: [dao],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['Controller'];
