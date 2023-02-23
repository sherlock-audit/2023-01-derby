import { deployments, run } from 'hardhat';
import { transferAndApproveUSDC } from '@testhelp/helpers';
import { Controller, MainVaultMock } from '@typechain';
import { allProtocols, compoundUSDC } from '@testhelp/addresses';
import allProviders from '@testhelp/classes/allProvidersClass';
import { getAllSigners, getContract } from '@testhelp/getContracts';

export const setupVault = deployments.createFixture(async (hre) => {
  await deployments.fixture([
    'TestVault1',
    'YearnProvider',
    'CompoundProvider',
    'AaveProvider',
    'TruefiProvider',
    'IdleProvider',
    'BetaProvider',
  ]);

  const vaultNumber = 10;
  const contract = 'TestVault1';
  const [dao, user, guardian] = await getAllSigners(hre);

  const vault = (await getContract(contract, hre, 'MainVaultMock')) as MainVaultMock;
  const controller = (await getContract('Controller', hre)) as Controller;

  await allProviders.setProviders(hre);
  await transferAndApproveUSDC(vault.address, user, 10_000_000 * 1e6);

  await run('vault_init', { contract });
  await run('controller_init');
  await run('controller_add_vault', { vault: vault.address });
  await run('controller_add_vault', { vault: guardian.address }); // using guardian as mock signer
  await run('controller_set_claimable', {
    lptoken: compoundUSDC,
    bool: true,
  });
  await run('vault_set_liquidity_perc', { contract, percentage: 10 });
  // add all protocol vaults to controller
  for (const protocol of allProtocols.values()) {
    await protocol.addProtocolToController(controller, dao, vaultNumber, allProviders);
  }

  return { vault, controller, dao, user, guardian, contract };
});
