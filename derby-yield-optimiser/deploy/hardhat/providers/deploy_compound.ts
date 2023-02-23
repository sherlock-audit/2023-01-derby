import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { comptroller } from '@testhelp/addresses';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('CompoundProvider', {
    from: deployer,
    args: [comptroller],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['CompoundProvider'];
