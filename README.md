# Derby contest details

- Join [Sherlock Discord](https://discord.gg/MABEWyASkp)
- Submit findings using the issue page in your private contest repo (label issues as med or high)
- [Read for more details](https://docs.sherlock.xyz/audits/watsons)

# Resources

- [Website](https://derby.finance/)
- [Docs](https://derby-finance.gitbook.io/derby-finance-docs/)
- [Twitter](https://twitter.com/derby_finance)
- [Medium](https://medium.com/derbyfinance)

# On-chain context

TO FILL IN BY PROTOCOL

```
DEPLOYMENT: [e.g. mainnet, arbitrum, optimism, ..]
ERC20: [e.g. any, none, USDC, USDC and USDT]
ERC721: [e.g. any, none, UNI-V3]
ERC777: [e.g. any, none, {token name}]
FEE-ON-TRANSFER: [e.g. any, none, {token name}]
REBASING TOKENS: [e.g. any, none, {token name}]
ADMIN: [trusted, restricted, n/a]
```

In case of restricted, by default Sherlock does not consider direct protocol rug pulls as a valid issue unless the protocol clearly describes in detail the conditions for these restrictions. 
For contracts, owners, admins clearly distinguish the ones controlled by protocol vs user controlled. This helps watsons distinguish the risk factor. 
Example: 
* `ContractA.sol` is owned by the protocol. 
* `admin` in `ContractB` is restricted to changing properties in `functionA` and should not be able to liquidate assets or affect user withdrawals in any way. 
* `admin` in `ContractC` is user admin and is restricted to only `functionB`

# Audit scope


[derby-yield-optimiser @ a20f134fd711dc418ed1a947431ded800a3ebace](https://github.com/derbyfinance/derby-yield-optimiser/tree/a20f134fd711dc418ed1a947431ded800a3ebace)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IALendingPool.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IALendingPool.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IAToken.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IAToken.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IBeta.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IBeta.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ICToken.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ICToken.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IComptroller.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IComptroller.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IConnext.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IConnext.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IExecutor.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IExecutor.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IIdle.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IIdle.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IQuoter.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IQuoter.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IStableSwap3Pool.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IStableSwap3Pool.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ISwapRouter.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ISwapRouter.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ITruefi.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/ITruefi.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Factory.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Factory.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Pool.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Pool.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IWETH.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IWETH.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IXReceiver.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IXReceiver.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IYearn.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IYearn.sol)
- [derby-yield-optimiser/contracts/Mocks/CompoundProviderMock.sol](derby-yield-optimiser/contracts/Mocks/CompoundProviderMock.sol)
- [derby-yield-optimiser/contracts/Mocks/Connext/ConnextMock.sol](derby-yield-optimiser/contracts/Mocks/Connext/ConnextMock.sol)
- [derby-yield-optimiser/contracts/Mocks/FrontendVault.sol](derby-yield-optimiser/contracts/Mocks/FrontendVault.sol)
- [derby-yield-optimiser/contracts/Mocks/GameMock.sol](derby-yield-optimiser/contracts/Mocks/GameMock.sol)
- [derby-yield-optimiser/contracts/Mocks/MainVaultMock.sol](derby-yield-optimiser/contracts/Mocks/MainVaultMock.sol)
- [derby-yield-optimiser/contracts/Mocks/XChainControllerMock.sol](derby-yield-optimiser/contracts/Mocks/XChainControllerMock.sol)
- [derby-yield-optimiser/contracts/Mocks/vaults/YearnVaultMock.sol](derby-yield-optimiser/contracts/Mocks/vaults/YearnVaultMock.sol)
- [derby-yield-optimiser/misc/provider-template/IProtocolName.sol](derby-yield-optimiser/misc/provider-template/IProtocolName.sol)
- [derby-yield-optimiser/misc/provider-template/Provider.sol](derby-yield-optimiser/misc/provider-template/Provider.sol)



TBD

# About Derby

TBD
