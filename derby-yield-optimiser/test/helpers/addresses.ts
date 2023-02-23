import { ProtocolVault } from './classes/protocolVaultClass';

// https://docs.connext.network/resources/supported-chains
export const testConnextChainIds = {
  goerli: 1735353714,
  optimismGoerli: 1735356532,
  mumbai: 9991,
};

// Stable coins
export const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const dai = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
export const usdt = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

/// Protocols
// Yearn
export const yearnUSDC = '0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE'; // 6
export const yearnDAI = '0xdA816459F1AB5631232FE5e97a05BBBb94970c95'; // 18
export const yearnUSDT = '0x3B27F92C0e212C671EA351827EDF93DB27cc0c65'; // 6
// compound
export const compoundUSDC = '0x39AA39c021dfbaE8faC545936693aC917d5E7563'; // 8
export const compoundDAI = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'; // 8
export const compoundUSDT = '0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9'; // 8
// Aave
export const aaveUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C'; // 6
export const aaveDAI = '0x028171bCA77440897B824Ca71D1c56caC55b68A3'; // 18
export const aaveUSDT = '0x3Ed3B47Dd13EC9a98b44e6204A523E766B225811'; // 6
// TrueFi
export const truefiUSDC = '0xA991356d261fbaF194463aF6DF8f0464F8f1c742'; // 6
export const truefiUSDT = '0x6002b1dcB26E7B1AA797A17551C6F487923299d7'; // 6
// Idle
export const idleUSDC = '0x5274891bEC421B39D23760c04A6755eCB444797C'; // 18
export const idleDAI = '0x3fE7940616e5Bc47b0775a0dccf6237893353bB4'; // 18
export const idleUSDT = '0xF34842d05A1c888Ca02769A633DF37177415C2f8'; // 18
// beta
export const betaUSDC = '0xC02392336420bb54CE2Da8a8aa4B118F2dceeB04'; // 6
export const betaDAI = '0x70540A3178290498B0C6d843Fa7ED97cAe69B86c'; // 18
export const betaUSDT = '0xBe1c71c94FebcA2673DB2E9BD610E2Cc80b950FC'; // 6

// Gov Tokens
export const aave = '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9';
export const yearn = '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e';
export const truefi = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784';
export const alpha = '0xa1faa113cbE53436Df28FF0aEe54275c13B40975';
export const idle = '0x875773784Af8135eA0ef43b5a374AaD105c5D39e';
export const beta = '0xBe1a001FE942f96Eea22bA08783140B9Dcc09D28';
export const compToken = '0xc00e94Cb662C3520282E6f5717214004A7f26888';
export const beefy = '0x5870700f1272a1AdbB87C3140bD770880a95e55D';

// Uniswap
export const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const uniswapRouter = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
export const uniswapQuoter = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

// Curve Finance
export const curve3Pool = '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'; // DAI / USDC / USDT

// others
export const comptroller = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';
export const WEth = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// whales for testing
export const CompWhale = '0xf977814e90da44bfa03b6295a0616a897441acec';
export const DAIWhale = '0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8';
export const USDCWhale = '0x55FE002aefF02F77364de339a1292923A15844B8';
export const USDTWhale = '0x5754284f345afc66a98fbB0a0Afe71e0F007B949';

export const yearn_usdc_01 = new ProtocolVault({
  name: 'yearn_usdc_01',
  protocolToken: yearnUSDC,
  underlyingToken: usdc,
  govToken: yearn,
  decimals: 6,
  chainId: 1,
});
export const yearn_dai_01 = new ProtocolVault({
  name: 'yearn_dai_01',
  protocolToken: yearnDAI,
  underlyingToken: dai,
  govToken: yearn,
  decimals: 18,
  chainId: 1,
});
export const yearn_usdt_01 = new ProtocolVault({
  name: 'yearn_usdt_01',
  protocolToken: yearnUSDT,
  underlyingToken: usdt,
  govToken: yearn,
  decimals: 6,
  chainId: 1,
});
export const compound_usdc_01 = new ProtocolVault({
  name: 'compound_usdc_01',
  protocolToken: compoundUSDC,
  underlyingToken: usdc,
  govToken: compToken,
  decimals: 8,
  chainId: 1,
});
export const compound_dai_01 = new ProtocolVault({
  name: 'compound_dai_01',
  protocolToken: compoundDAI,
  underlyingToken: dai,
  govToken: compToken,
  decimals: 8,
  chainId: 1,
});
export const compound_usdt_01 = new ProtocolVault({
  name: 'compound_usdt_01',
  protocolToken: compoundUSDT,
  underlyingToken: usdt,
  govToken: compToken,
  decimals: 8,
  chainId: 1,
});
export const aave_usdc_01 = new ProtocolVault({
  name: 'aave_usdc_01',
  protocolToken: aaveUSDC,
  underlyingToken: usdc,
  govToken: aave,
  decimals: 6,
  chainId: 1,
});
export const aave_dai_01 = new ProtocolVault({
  name: 'aave_dai_01',
  protocolToken: aaveDAI,
  underlyingToken: dai,
  govToken: aave,
  decimals: 18,
  chainId: 1,
});
export const aave_usdt_01 = new ProtocolVault({
  name: 'aave_usdt_01',
  protocolToken: aaveUSDT,
  underlyingToken: usdt,
  govToken: aave,
  decimals: 6,
  chainId: 1,
});
export const truefi_usdc_01 = new ProtocolVault({
  name: 'truefi_usdc_01',
  protocolToken: truefiUSDC,
  underlyingToken: usdc,
  govToken: truefi,
  decimals: 6,
  chainId: 1,
});
export const truefi_usdt_01 = new ProtocolVault({
  name: 'truefi_usdt_01',
  protocolToken: truefiUSDT,
  underlyingToken: usdt,
  govToken: truefi,
  decimals: 6,
  chainId: 1,
});
export const idle_usdc_01 = new ProtocolVault({
  name: 'idle_usdc_01',
  protocolToken: idleUSDC,
  underlyingToken: usdc,
  govToken: idle,
  decimals: 18,
  chainId: 1,
});
export const idle_dai_01 = new ProtocolVault({
  name: 'idle_dai_01',
  protocolToken: idleDAI,
  underlyingToken: dai,
  govToken: idle,
  decimals: 18,
  chainId: 1,
});
export const idle_usdt_01 = new ProtocolVault({
  name: 'idle_usdt_01',
  protocolToken: idleUSDT,
  underlyingToken: usdt,
  govToken: idle,
  decimals: 18,
  chainId: 1,
});
export const beta_usdc_01 = new ProtocolVault({
  name: 'beta_usdc_01',
  protocolToken: betaUSDC,
  underlyingToken: usdc,
  govToken: beta,
  decimals: 6,
  chainId: 1,
});
export const beta_dai_01 = new ProtocolVault({
  name: 'beta_dai_01',
  protocolToken: betaDAI,
  underlyingToken: dai,
  govToken: beta,
  decimals: 18,
  chainId: 1,
});
export const beta_usdt_01 = new ProtocolVault({
  name: 'beta_usdt_01',
  protocolToken: betaUSDT,
  underlyingToken: usdt,
  govToken: beta,
  decimals: 6,
  chainId: 1,
});

export const starterProtocols = new Map<string, ProtocolVault>();

starterProtocols
  .set('compound_usdc_01', compound_usdc_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('yearn_usdc_01', yearn_usdc_01);

export const allProtocols = new Map<string, ProtocolVault>();

allProtocols
  .set('yearn_usdc_01', yearn_usdc_01)
  .set('yearn_dai_01', yearn_dai_01)
  .set('yearn_usdt_01', yearn_usdt_01)
  .set('compound_usdc_01', compound_usdc_01)
  .set('compound_dai_01', compound_dai_01)
  .set('compound_usdt_01', compound_usdt_01)
  .set('aave_usdc_01', aave_usdc_01)
  .set('aave_dai_01', aave_dai_01)
  .set('aave_usdt_01', aave_usdt_01)
  .set('truefi_usdc_01', truefi_usdc_01)
  .set('truefi_usdt_01', truefi_usdt_01)
  .set('idle_usdc_01', idle_usdc_01)
  .set('idle_dai_01', idle_dai_01)
  .set('idle_usdt_01', idle_usdt_01)
  .set('beta_usdc_01', beta_usdc_01)
  .set('beta_dai_01', beta_dai_01)
  .set('beta_usdt_01', beta_usdt_01);
