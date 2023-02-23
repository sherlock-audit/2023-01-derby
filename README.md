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
- [derby-yield-optimiser/contracts/Controller.sol](derby-yield-optimiser/contracts/Controller.sol)
- [derby-yield-optimiser/contracts/DerbyToken.sol](derby-yield-optimiser/contracts/DerbyToken.sol)
- [derby-yield-optimiser/contracts/Game.sol](derby-yield-optimiser/contracts/Game.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Factory.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Factory.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Pool.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IUniswapV3Pool.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IWETH.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IWETH.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IXReceiver.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IXReceiver.sol)
- [derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IYearn.sol](derby-yield-optimiser/contracts/Interfaces/ExternalInterfaces/IYearn.sol)
- [derby-yield-optimiser/contracts/Interfaces/IController.sol](derby-yield-optimiser/contracts/Interfaces/IController.sol)
- [derby-yield-optimiser/contracts/Interfaces/IGame.sol](derby-yield-optimiser/contracts/Interfaces/IGame.sol)
- [derby-yield-optimiser/contracts/Interfaces/IGoverned.sol](derby-yield-optimiser/contracts/Interfaces/IGoverned.sol)
- [derby-yield-optimiser/contracts/Interfaces/IProvider.sol](derby-yield-optimiser/contracts/Interfaces/IProvider.sol)
- [derby-yield-optimiser/contracts/Interfaces/IVault.sol](derby-yield-optimiser/contracts/Interfaces/IVault.sol)
- [derby-yield-optimiser/contracts/Interfaces/IXChainController.sol](derby-yield-optimiser/contracts/Interfaces/IXChainController.sol)
- [derby-yield-optimiser/contracts/Interfaces/IXProvider.sol](derby-yield-optimiser/contracts/Interfaces/IXProvider.sol)
- [derby-yield-optimiser/contracts/MainVault.sol](derby-yield-optimiser/contracts/MainVault.sol)
- [derby-yield-optimiser/contracts/Providers/AaveProvider.sol](derby-yield-optimiser/contracts/Providers/AaveProvider.sol)
- [derby-yield-optimiser/contracts/Providers/BetaProvider.sol](derby-yield-optimiser/contracts/Providers/BetaProvider.sol)
- [derby-yield-optimiser/contracts/Providers/CompoundProvider.sol](derby-yield-optimiser/contracts/Providers/CompoundProvider.sol)
- [derby-yield-optimiser/contracts/Providers/IdleProvider.sol](derby-yield-optimiser/contracts/Providers/IdleProvider.sol)
- [derby-yield-optimiser/contracts/Providers/TruefiProvider.sol](derby-yield-optimiser/contracts/Providers/TruefiProvider.sol)
- [derby-yield-optimiser/contracts/Providers/YearnProvider.sol](derby-yield-optimiser/contracts/Providers/YearnProvider.sol)
- [derby-yield-optimiser/contracts/TokenTimelock.sol](derby-yield-optimiser/contracts/TokenTimelock.sol)
- [derby-yield-optimiser/contracts/Vault.sol](derby-yield-optimiser/contracts/Vault.sol)
- [derby-yield-optimiser/contracts/VaultToken.sol](derby-yield-optimiser/contracts/VaultToken.sol)
- [derby-yield-optimiser/contracts/XChainController.sol](derby-yield-optimiser/contracts/XChainController.sol)
- [derby-yield-optimiser/contracts/XProvider.sol](derby-yield-optimiser/contracts/XProvider.sol)
- [derby-yield-optimiser/contracts/libraries/Swap.sol](derby-yield-optimiser/contracts/libraries/Swap.sol)



# About Derby

TBD
