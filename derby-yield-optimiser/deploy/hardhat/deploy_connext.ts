import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer, dao } = await getNamedAccounts();

  await deploy('ConnextMock', {
    from: deployer,
    contract: 'ConnextMock',
    args: [],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['ConnextMock'];
