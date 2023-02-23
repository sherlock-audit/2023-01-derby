import { getInitConfigController } from '@testhelp/deployHelpers';
import { Result } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const getController = async ({
  deployments,
  ethers,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  await deployments.all();
  const accounts = await getNamedAccounts();
  const dao = await ethers.getSigner(accounts.dao);

  const { address } = await deployments.get('Controller');
  const controller = await ethers.getContractAt('Controller', address);
  return { controller, dao };
};

task('controller_init', 'Initializes the controller').setAction(async (_, { run, network }) => {
  const initConfig = await getInitConfigController(network.name);
  if (!initConfig) throw 'Unknown contract name';

  const {
    dai,
    usdc,
    usdt,
    daiCurveIndex,
    usdcCurveIndex,
    usdtCurveIndex,
    uniswapRouter,
    uniswapQouter,
    uniswapPoolFee,
    curve3PoolFee,
    curve3Pool,
  } = initConfig;

  await run('controller_add_curve_index', { token: dai, index: daiCurveIndex });
  await run('controller_add_curve_index', { token: usdc, index: usdcCurveIndex });
  await run('controller_add_curve_index', { token: usdt, index: usdtCurveIndex });
  await run('controller_set_curve_poolfee', { poolfee: curve3PoolFee });
  await run('controller_set_curve_3pool', { pool: curve3Pool });
  await run('controller_set_uniswap_router', { router: uniswapRouter });
  await run('controller_set_uniswap_quoter', { quoter: uniswapQouter });
  await run('controller_set_uniswap_poolfee', { poolfee: uniswapPoolFee });
  await run('controller_add_underlying_scale', { stable: usdc, decimals: 6 });
  await run('controller_add_underlying_scale', { stable: dai, decimals: 18 });
  await run('controller_add_underlying_scale', { stable: usdt, decimals: 6 });
});

task('controller_add_protocol', 'Add protocol to controller')
  .addParam('name', 'Name of the protocol vault combination')
  .addParam('vaultnumber', 'Number of the vault', 0, types.int)
  .addParam('provider', 'Address of the protocol provider')
  .addParam('protocoltoken', 'Address of protocolToken eg cUSDC')
  .addParam('underlying', 'Address of underlying protocol vault eg USDC')
  .addParam('govtoken', 'Address governance token of the protocol')
  .addParam('uscale', 'Underlying scale of the protocol', 0, types.int)
  .setAction(
    async ({ name, vaultnumber, provider, protocoltoken, underlying, govtoken, uscale }, hre) => {
      const { controller, dao } = await getController(hre);

      const tx = await controller
        .connect(dao)
        .addProtocol(name, vaultnumber, provider, protocoltoken, underlying, govtoken, uscale);

      const receipt = await tx.wait();
      const { protocolNumber } = receipt.events![0].args as Result;

      return protocolNumber;
    },
  );

task('controller_add_vault', 'Add vault to controller whitelist')
  .addParam('vault', 'Address of the vault')
  .setAction(async ({ vault }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addVault(vault);
  });

task('controller_set_uniswap_router', 'Set the Uniswap Router address')
  .addParam('router', 'Address of the router')
  .setAction(async ({ router }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapRouter(router);
  });

task('controller_set_uniswap_quoter', 'Set the Uniswap Quoter address')
  .addParam('quoter', 'Address of the quoter')
  .setAction(async ({ quoter }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapQuoter(quoter);
  });

task('controller_set_uniswap_poolfee', 'Set the Uniswap Poolfee')
  .addParam('poolfee', 'Uniswap pool fee', null, types.int)
  .setAction(async ({ poolfee }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setUniswapPoolFee(poolfee);
  });

task('controller_set_curve_poolfee', 'Set the Curve Poolfee')
  .addParam('poolFee', 'Curve pool fee', null, types.int)
  .setAction(async ({ poolfee }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setCurvePoolFee(poolfee);
  });

task('controller_add_curve_index', 'Set curve pool index for underlying token')
  .addParam('token', 'Address of Token')
  .addParam('index', 'Curve index as decribed in Swap pool', null, types.int)
  .setAction(async ({ token, index }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addCurveIndex(token, index);
  });

task('controller_set_curve_3pool', 'Setter curve3Pool address')
  .addParam('pool', 'New dao address')
  .setAction(async ({ pool }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setCurve3Pool(pool);
  });

task('controller_add_underlying_scale', 'Set the scale for underlying stable coin')
  .addParam('stable', 'Address of stable coin')
  .addParam('decimals', 'Scale e.g decimals of stable', null, types.int)
  .setAction(async ({ stable, decimals }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).addUnderlyingUScale(stable, decimals);
  });

task('controller_set_claimable', 'Set if provider have claimable tokens')
  .addParam('lptoken', 'Address of protocol lptoken')
  .addParam('bool', 'True of the underlying protocol has claimable tokens', null, types.boolean)
  .setAction(async ({ lptoken, bool }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setClaimable(lptoken, bool);
  });

task('controller_set_dao', 'Setter for dao address')
  .addParam('daoaddr', 'New dao address')
  .setAction(async ({ daoaddr }, hre) => {
    const { controller, dao } = await getController(hre);
    await controller.connect(dao).setDao(daoaddr);
  });
