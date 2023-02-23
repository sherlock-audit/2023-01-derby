import { BigNumber, ContractFunction, Signer } from 'ethers';
import { ethers, network, run } from 'hardhat';
import erc20ABI from '../../abis/erc20.json';
import cTokenABI from '../../abis/cToken.json';
import { Controller } from '@typechain';
import { Result } from 'ethers/lib/utils';
import {
  aave as aaveGov,
  aaveUSDC,
  compoundUSDC,
  compToken,
  dai,
  usdc,
  yearn as yearnGov,
  yearnUSDC,
} from './addresses';

const provider = ethers.provider;

const DAIWhale = '0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8';
const USDCWhale = '0x55FE002aefF02F77364de339a1292923A15844B8';
const USDTWhale = '0x5754284f345afc66a98fbB0a0Afe71e0F007B949';

export async function transferAndApproveUSDC(vault: string, user: Signer, amount: number) {
  const usdcSigner = await getUSDCSigner();
  const IUSDC = erc20(usdc);

  // resets balance for testing
  const balance = await IUSDC.balanceOf(user.getAddress());
  if (balance > 0) {
    await IUSDC.connect(user).transfer(USDCWhale, balance);
  }

  await IUSDC.connect(usdcSigner).transfer(user.getAddress(), amount);
  await IUSDC.connect(user).approve(vault, amount);

  return { IUSDC };
}

export async function transferAndApproveDAI(vault: string, user: Signer, amount: number) {
  const daiSigner = await getDAISigner();
  const IDAI = erc20(dai);

  // resets balance for testing
  const balance = await IDAI.balanceOf(user.getAddress());
  if (balance > 0) {
    await IDAI.connect(user).transfer(DAIWhale, balance);
  }

  await IDAI.connect(daiSigner).transfer(user.getAddress(), parseEther(amount));
  await IDAI.connect(user).approve(vault, parseEther(amount));

  return { IDAI };
}

export async function addStarterProtocols(
  { yearn, compound, aave }: IStarterProviders,
  vaultNumber: number,
) {
  const yearnNumber = await run(`controller_add_protocol`, {
    name: 'yearn_usdc_01',
    vaultnumber: vaultNumber,
    provider: yearn,
    protocoltoken: yearnUSDC,
    underlying: usdc,
    govtoken: yearnGov,
    uscale: 1e6,
  });
  const compNumber = await run(`controller_add_protocol`, {
    name: 'compound_usdc_01',
    vaultnumber: vaultNumber,
    provider: compound,
    protocoltoken: compoundUSDC,
    underlying: usdc,
    govtoken: compToken,
    uscale: 1e6,
  });
  const aaveNumber = await run(`controller_add_protocol`, {
    name: 'aave_usdc_01',
    vaultnumber: vaultNumber,
    provider: aave,
    protocoltoken: aaveUSDC,
    underlying: usdc,
    govtoken: aaveGov,
    uscale: 1e6,
  });

  return [yearnNumber, compNumber, aaveNumber];
}

export const random = (max: number) => Math.floor(Math.random() * max);

// SIGNERS
export const getDAISigner = async () => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [DAIWhale],
  });
  return ethers.provider.getSigner(DAIWhale);
};

export const getUSDTSigner = async () => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [USDTWhale],
  });
  return ethers.provider.getSigner(USDTWhale);
};

export const getUSDCSigner = async () => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [USDCWhale],
  });
  return ethers.provider.getSigner(USDCWhale);
};

export const getWhale = async (address: string) => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  return ethers.provider.getSigner(address);
};

export const controllerAddProtocol = async (
  controller: Controller,
  name: string,
  ETFnumber: number,
  providerAddr: string,
  protocolToken: string,
  protocolUnderlying: string,
  govToken: string,
  uScale: string,
) => {
  const tx = await controller.addProtocol(
    name,
    ETFnumber,
    providerAddr,
    protocolToken,
    protocolUnderlying,
    govToken,
    uScale,
  );
  const receipt = await tx.wait();
  const { protocolNumber } = receipt.events![0].args as Result;

  return Number(protocolNumber);
};

export const getEvent = async (tx: Promise<any>): Promise<Result> => {
  const transaction = await tx;
  const receipt = await transaction.wait();
  return receipt.events![0].args as Result;
};

export const erc20 = (tokenAddress: string) => {
  return new ethers.Contract(tokenAddress, erc20ABI, provider);
};

export const cToken = (tokenAddress: string) => {
  return new ethers.Contract(tokenAddress, cTokenABI, provider);
};

// FORMATTING
export const parseEther = (amount: string | number) => ethers.utils.parseEther(amount.toString());
export const formatEther = (amount: string | BigNumber) => Number(ethers.utils.formatEther(amount));
export const parseUnits = (amount: string | number, number: number) =>
  ethers.utils.parseUnits(amount.toString(), number);
export const formatUnits = (amount: string | BigNumber, number: number) =>
  Number(ethers.utils.formatUnits(amount, number));
export const parseUSDC = (amount: string | number) => ethers.utils.parseUnits(amount.toString(), 6);
export const formatUSDC = (amount: string | BigNumber) =>
  Number(ethers.utils.formatUnits(amount, 6));
export const parseDAI = (amount: string) => ethers.utils.parseUnits(amount, 18);
export const formatDAI = (amount: string | BigNumber) => ethers.utils.formatUnits(amount, 18);
export const parseDRB = (amount: number) => ethers.utils.parseUnits(amount.toString(), 18);
export const formatDRB = (amount: number | BigNumber) => ethers.utils.formatUnits(amount, 18);

type IStarterProviders = {
  yearn: string;
  compound: string;
  aave: string;
};
