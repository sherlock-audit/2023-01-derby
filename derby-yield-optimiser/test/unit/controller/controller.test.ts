import { expect } from 'chai';
import { deployments, run } from 'hardhat';
import {
  deployAaveProviderMock,
  deployCompoundProviderMock,
  deployYearnProviderMock,
} from '@testhelp/deployMocks';
import {
  usdc,
  yearn as yearnGov,
  compToken as compGov,
  aave as aaveGov,
  compoundUSDC,
  yearnUSDC,
  aaveUSDC,
} from '@testhelp/addresses';
import { addStarterProtocols } from '@testhelp/helpers';
import { getAllSigners, getContract } from '@testhelp/getContracts';
import { Controller } from '@typechain';

const vaultNumber = 4;

describe('Testing controller', async () => {
  const setupController = deployments.createFixture(async (hre) => {
    await deployments.fixture(['Controller']);
    const controller = (await getContract('Controller', hre)) as Controller;
    const [, , , vault, deployer] = await getAllSigners(hre);

    await run('controller_init');
    await run('controller_add_vault', { vault: vault.address });

    const [yearnProviderMock, compoundProviderMock, aaveProviderMock] = await Promise.all([
      deployYearnProviderMock(deployer),
      deployCompoundProviderMock(deployer),
      deployAaveProviderMock(deployer),
    ]);

    const [yearnNumber, compNumber, aaveNumber] = await addStarterProtocols(
      {
        yearn: yearnProviderMock.address,
        compound: compoundProviderMock.address,
        aave: aaveProviderMock.address,
      },
      vaultNumber,
    );

    return {
      controller,
      vault,
      yearnProviderMock,
      compoundProviderMock,
      aaveProviderMock,
      yearnNumber,
      compNumber,
      aaveNumber,
    };
  });

  it('Should correctly set controller mappings for the protocol names', async function () {
    const { controller, yearnNumber, compNumber, aaveNumber } = await setupController();
    const [yearn, compound, aave] = await Promise.all([
      controller.protocolNames(vaultNumber, yearnNumber),
      controller.protocolNames(vaultNumber, compNumber),
      controller.protocolNames(vaultNumber, aaveNumber),
    ]);

    expect(yearn).to.be.equal('yearn_usdc_01');
    expect(compound).to.be.equal('compound_usdc_01');
    expect(aave).to.be.equal('aave_usdc_01');
  });

  it('Should correctly set controller mappings for the protocol provider, LPtoken, underlying', async function () {
    const {
      controller,
      yearnProviderMock,
      compoundProviderMock,
      aaveProviderMock,
      yearnNumber,
      compNumber,
      aaveNumber,
    } = await setupController();

    const [yearn, compound, aave] = await Promise.all([
      controller.getProtocolInfo(vaultNumber, yearnNumber),
      controller.getProtocolInfo(vaultNumber, compNumber),
      controller.getProtocolInfo(vaultNumber, aaveNumber),
    ]);

    expect(yearn.provider).to.be.equal(yearnProviderMock.address);
    expect(compound.provider).to.be.equal(compoundProviderMock.address);
    expect(aave.provider).to.be.equal(aaveProviderMock.address);

    expect(yearn.LPToken).to.be.equal(yearnUSDC);
    expect(compound.LPToken).to.be.equal(compoundUSDC);
    expect(aave.LPToken).to.be.equal(aaveUSDC);

    expect(yearn.underlying).to.be.equal(usdc);
    expect(compound.underlying).to.be.equal(usdc);
    expect(aave.underlying).to.be.equal(usdc);
  });

  it('Should correctly set governance tokens', async function () {
    const { controller, yearnNumber, compNumber, aaveNumber } = await setupController();

    const [yearn, compound, aave] = await Promise.all([
      controller.getGovToken(vaultNumber, yearnNumber),
      controller.getGovToken(vaultNumber, compNumber),
      controller.getGovToken(vaultNumber, aaveNumber),
    ]);

    expect(yearn).to.be.equal(yearnGov);
    expect(compound).to.be.equal(compGov);
    expect(aave).to.be.equal(aaveGov);
  });

  it('Should correctly set protocol blacklist', async function () {
    const { controller, vault, yearnNumber } = await setupController();

    let blacklisted = await controller
      .connect(vault)
      .getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.equal(false);

    await controller.connect(vault).setProtocolBlacklist(vaultNumber, yearnNumber);

    blacklisted = await controller.connect(vault).getProtocolBlacklist(vaultNumber, yearnNumber);
    expect(blacklisted).to.equal(true);
  });

  it('Should reach the claim function in compound Provider', async function () {
    const { controller, vault, compoundProviderMock, compNumber } = await setupController();

    await run('controller_set_claimable', { lptoken: compoundUSDC, bool: true });

    // Using revert here to make sure the function actually reached the mocked function with arguments
    await compoundProviderMock.mock.claim
      .withArgs(compoundUSDC, vault.address)
      .revertsWithReason('Claimed tokens');

    await expect(controller.connect(vault).claim(vaultNumber, compNumber)).to.be.revertedWith(
      'Claimed tokens',
    );
  });
});
