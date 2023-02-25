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

The README is a **very important** document for the audit. Please fill it out thoroughly and include any other specific info that security experts will need in order to effectively review the codebase.

**Some pointers for filling out the section below:**  
ERC20/ERC721/ERC777/FEE-ON-TRANSFER/REBASING TOKENS:  
*Which tokens do you expect will interact with the smart contracts? Please note that these answers have a significant impact on the issues that will be submitted by Watsons. Please list specific tokens (ETH, USDC, DAI) where possible, otherwise "Any"/"None" type answers are acceptable as well.*

ADMIN:
*Admin/owner of the protocol/contracts.
Label as TRUSTED, If you **don't** want to receive issues about the admin of the contract being able to steal funds. 
If you want to receive issues about the Admin of the contract being able to steal funds, label as RESTRICTED & list specific acceptable/unacceptable actions for the admins.*

EXTERNAL ADMIN:
*These are admins of the protocols your contracts integrate with (if any). 
If you **don't** want to receive issues about this Admin being able to steal funds or result in loss of funds, label as TRUSTED
If you want to receive issues about this admin being able to steal or result in loss of funds, label as RESTRICTED.*
 
```
DEPLOYMENT: [e.g. mainnet, Arbitrum, Optimism, ..]
ERC20: [e.g. any, none, USDC, USDC and USDT]
ERC721: [e.g. any, none, UNI-V3]
ERC777: [e.g. any, none, {token name}]
FEE-ON-TRANSFER: [e.g. any, none, {token name}]
REBASING TOKENS: [e.g. any, none, {token name}]
ADMIN: [trusted, restricted, n/a]
EXTERNAL-ADMINS: [trusted, restricted, n/a]
```


Please answer the following questions to provide more context: 
### Q: Are there any additional protocol roles? If yes, please explain in detail:
1) The roles
2) The actions those roles can take 
3) Outcomes that are expected from those roles 
4) Specific actions/outcomes NOT intended to be possible for those roles

A: 

___
### Q: Is the code/contract expected to comply with any EIPs? Are there specific assumptions around adhering to those EIPs that Watsons should be aware of?
A:

___

### Q: Please list any known issues/acceptable risks that should not result in a valid finding.
A: 

____
### Q: Please provide links to previous audits (if any).
A:

___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, input validation expectations, etc)? 
A: 
_____

### Q: In case of external protocol integrations, are the risks of an external protocol pausing or executing an emergency withdrawal acceptable? If not, Watsons will submit issues related to these situations that can harm your protocol's functionality. 
A: [ACCEPTABLE/NOT ACCEPTABLE] 


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
