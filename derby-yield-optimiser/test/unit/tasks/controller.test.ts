import { deployments, run } from 'hardhat';
import { expect } from 'chai';
import { usdc, yearn, yearnUSDC } from '@testhelp/addresses';
import { getInitConfigController } from '@testhelp/deployHelpers';
import { Controller } from '@typechain';

describe('Testing controller tasks', () => {
  const setupController = deployments.createFixture(async ({ deployments, ethers, network }) => {
    await deployments.fixture(['Controller']);
    const deployment = await deployments.get('Controller');
    const controller = (await ethers.getContractAt('Controller', deployment.address)) as Controller;
    const controllerInit = await getInitConfigController(network.name);

    await run('controller_init');

    return { controller, controllerInit };
  });

  it('controller_add_protocol', async function () {
    const { controller } = await setupController();
    const vaultNumber = 10;
    const providerAddress = '0x90c84237fddf091b1e63f369af122eb46000bc70'; // dummy

    const protocolNumber = await run(`controller_add_protocol`, {
      name: 'yearn_usdc_01',
      vaultnumber: vaultNumber,
      provider: providerAddress,
      protocoltoken: yearnUSDC,
      underlying: usdc,
      govtoken: yearn,
      uscale: 1e6,
    });

    const protocolInfo = await controller.getProtocolInfo(vaultNumber, protocolNumber);
    expect(protocolInfo.LPToken.toLowerCase()).to.be.equal(yearnUSDC.toLowerCase());
    expect(protocolInfo.provider.toLowerCase()).to.be.equal(providerAddress.toLowerCase());
    expect(protocolInfo.underlying.toLowerCase()).to.be.equal(usdc.toLowerCase());
    expect(protocolInfo.uScale).to.be.equal(1e6);
  });

  it('controller_add_vault', async function () {
    const vault = '0x90c84237fddf091b1e63f369af122eb46000bc70';
    const { controller } = await setupController();

    expect(await controller.vaultWhitelist(vault)).to.be.equal(false);
    await run('controller_add_vault', { vault });
    expect(await controller.vaultWhitelist(vault)).to.be.equal(true);
  });

  it('controller_uniswap_setters', async function () {
    const { controller, controllerInit } = await setupController();
    const { uniswapQouter, uniswapPoolFee, uniswapRouter } = controllerInit;

    await Promise.all([
      run('controller_set_uniswap_router', { router: uniswapRouter }),
      run('controller_set_uniswap_quoter', { quoter: uniswapQouter }),
      run('controller_set_uniswap_poolfee', { poolfee: uniswapPoolFee }),
    ]);

    const uniswapParams = await controller.getUniswapParams();
    expect(uniswapParams.router).to.be.equal(uniswapRouter);
    expect(uniswapParams.quoter).to.be.equal(uniswapQouter);
    expect(uniswapParams.poolFee).to.be.equal(uniswapPoolFee);
  });

  it('controller_set_curve_poolfee', async function () {
    const { controller, controllerInit } = await setupController();
    const { curve3PoolFee } = controllerInit;

    await run('controller_set_curve_poolfee', { poolfee: curve3PoolFee });
    expect(await controller.curve3PoolFee()).to.be.equal(curve3PoolFee);
  });

  it('controller_add_curve_index', async function () {
    const curveIndex = 11;
    const { controller } = await setupController();

    await run('controller_add_curve_index', { token: usdc, index: curveIndex });
    expect(await controller.curveIndex(usdc)).to.be.equal(curveIndex);
  });

  it('controller_add_underlying_scale', async function () {
    const decimals = 8;
    const { controller } = await setupController();

    await run('controller_add_underlying_scale', { stable: usdc, decimals: decimals });
    expect(await controller.underlyingUScale(usdc)).to.be.equal(10 ** decimals);
  });

  it('controller_set_claimable', async function () {
    const lptoken = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const { controller } = await setupController();

    expect(await controller.claimable(lptoken)).to.be.equal(false);
    await run('controller_set_claimable', { lptoken, bool: true });
    expect(await controller.claimable(lptoken)).to.be.equal(true);
  });

  it('controller_set_curve_3pool', async function () {
    const { controller, controllerInit } = await setupController();
    const { curve3Pool } = controllerInit;

    await run('controller_set_curve_3pool', { pool: curve3Pool });
    expect(await controller.curve3Pool()).to.be.equal(curve3Pool);
  });

  it('controller_set_dao', async function () {
    const dao = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7';
    const { controller } = await setupController();

    await run('controller_set_dao', { daoaddr: dao });
    expect(await controller.getDao()).to.be.equal(dao);
  });
});
