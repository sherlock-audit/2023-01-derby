import { readFile } from 'fs/promises';
import { join } from 'path';

export async function getTokenConfig(network: string): Promise<ITokenConfig> {
  const config = await getConfig(network);
  return config['DerbyToken'];
}

export async function getDeployConfigXController(
  network: string,
): Promise<IDeployXControllerConfig> {
  const config = await getConfig(network);
  return config['XChainController']?.deploy;
}

export async function getDeployConfigGame(network: string): Promise<IDeployGameConfig> {
  const config = await getConfig(network);
  return config['Game']?.deploy;
}

export async function getInitConfigGame(network: string): Promise<IInitGameConfig> {
  const config = await getConfig(network);
  return config['Game']?.init;
}

export async function getDeployConfigXProvider(network: string): Promise<IDeployXProviderConfig> {
  const config = await getConfig(network);
  return config['XProvider']?.deploy;
}

export async function getDeployConfigVault(
  vaultName: string,
  network: string,
): Promise<IDeployVaultConfig> {
  const config = await getConfig(network);
  return config[vaultName]?.deploy;
}

export async function getInitConfigVault(
  vaultName: string,
  network: string,
): Promise<IInitVaultConfig> {
  const config = await getConfig(network);
  return config[vaultName]?.init;
}

export async function getInitConfigController(network: string): Promise<IInitControllerConfig> {
  const config = await getConfig(network);
  return config['Controller']?.init;
}

export async function getConfig(network: string) {
  const path = join(__dirname, '..', '..', 'deploy', 'configs', `${network}.json`);
  return JSON.parse(await readFile(path, 'utf8'));
}

type ITokenConfig = {
  name: string;
  symbol: string;
  totalSupply: number;
};

type IDeployXControllerConfig = {
  homeChainId: number;
};

type IDeployGameConfig = {
  nftName: string;
  nftSymbol: string;
};

type IInitGameConfig = {
  negativeRewardFactor: number;
  negativeRewardThreshold: number;
};

type IDeployXProviderConfig = {
  layerZeroEndpoint: string;
  connextHandler: string;
  mainnet: number;
  arbitrum: number;
  optimism: number;
  bnb: number;
};

type IDeployVaultConfig = {
  name: string;
  symbol: string;
  decimals: number;
  vaultNumber: number;
  vaultCurrency: string;
  uScale: number;
};

type IInitVaultConfig = {
  rebalanceInterval: number;
  marginScale: number;
  liquidityPercentage: number;
  performanceFee: number;
  homeChain: number;
};

type IInitControllerConfig = {
  dai: string;
  usdc: string;
  usdt: string;
  daiCurveIndex: number;
  usdcCurveIndex: number;
  usdtCurveIndex: number;
  curve3PoolFee: number;
  curve3Pool: string;
  uniswapRouter: string;
  uniswapQouter: string;
  uniswapPoolFee: number;
  chainlinkGasPriceOracle: string;
};
