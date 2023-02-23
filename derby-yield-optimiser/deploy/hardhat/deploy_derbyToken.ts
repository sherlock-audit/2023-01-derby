import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getTokenConfig } from '@testhelp/deployHelpers';

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
  network,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const tokenConfig = await getTokenConfig(network.name);
  if (!tokenConfig) throw 'Unknown contract name';

  const { name, symbol, totalSupply } = tokenConfig;

  await deploy('DerbyToken', {
    from: deployer,
    args: [name, symbol, ethers.utils.parseEther(totalSupply.toString())],
    log: true,
    autoMine: true,
  });
};
export default func;
func.tags = ['DerbyToken'];
