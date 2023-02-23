import { waffle } from 'hardhat';
const { deployMockContract } = waffle;
import { MockContract } from '@ethereum-waffle/mock-contract';
import { Signer } from 'ethers';

import YearnProviderArtifact from '@artifacts/Providers/YearnProvider.sol/YearnProvider.json';
import CompoundProviderArtifact from '@artifacts/Providers/CompoundProvider.sol/CompoundProvider.json';
import AaveProviderArtifact from '@artifacts/Providers/AaveProvider.sol/AaveProvider.json';
import ControllerArtifact from '@artifacts/Controller.sol/Controller.json';
import erc20ABI from '../../abis/erc20.json';

export const deployYearnProviderMock = (deployerSign: Signer): Promise<MockContract> => {
  return deployMockContract(deployerSign, YearnProviderArtifact.abi) as Promise<MockContract>;
};

export const deployCompoundProviderMock = (deployerSign: Signer): Promise<MockContract> => {
  return deployMockContract(deployerSign, CompoundProviderArtifact.abi) as Promise<MockContract>;
};

export const deployAaveProviderMock = (deployerSign: Signer): Promise<MockContract> => {
  return deployMockContract(deployerSign, AaveProviderArtifact.abi) as Promise<MockContract>;
};

export const deployControllerMock = (deployerSign: Signer): Promise<MockContract> => {
  return deployMockContract(deployerSign, ControllerArtifact.abi) as Promise<MockContract>;
};

export const deployERC20Mock = (deployerSign: Signer): Promise<MockContract> => {
  return deployMockContract(deployerSign, erc20ABI) as Promise<MockContract>;
};
