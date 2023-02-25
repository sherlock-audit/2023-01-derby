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

External tokens: USDC, DAI and USDT
Own token: DerbyToken
LP tokens: VaultToken

ADMIN:
*Admin/owner of the protocol/contracts.
Label as TRUSTED, If you **don't** want to receive issues about the admin of the contract being able to steal funds. 
If you want to receive issues about the Admin of the contract being able to steal funds, label as RESTRICTED & list specific acceptable/unacceptable actions for the admins.*

Guardian: the guardian is there to manually restart the protocol when it's stuck during rebalancing or cross chain rebalancing. The guardian is controlled by a single entity because it needs to be able to act quickly.

EXTERNAL ADMIN:
*These are admins of the protocols your contracts integrate with (if any). 
If you **don't** want to receive issues about this Admin being able to steal funds or result in loss of funds, label as TRUSTED
If you want to receive issues about this admin being able to steal or result in loss of funds, label as RESTRICTED.*

DAO: the DAO is there to perform admin functions. The DAO is controlled by a multisig in the beginning and in the foreseeable future. 
 
```
DEPLOYMENT: Mainnet, Arbitrum, Optimism, Polygon, Binance Smart Chain
ERC20: USDC, DAI, USDT, own DerbyToken and own VaultToken
ERC721: own Game token
ERC777: N.A.
FEE-ON-TRANSFER: none
REBASING TOKENS: VaultToken
ADMIN: trusted
EXTERNAL-ADMINS: trusted
```


Please answer the following questions to provide more context: 
### Q: Are there any additional protocol roles? If yes, please explain in detail:
1) The roles
Game players. These are DerbyToken tokenholders that together determine the distribution of the vault funds over all the different underlying DeFi protocols (e.g. Compound, Aave, Yearn etc). 
2) The actions those roles can take 
A DerbyToken tokenholder can, via interacting with the Game contract, determine a part of the distribution of the vault funds that is proportional to the amount of tokens it has. During rebalancing a snapshot is taken of the joint distribution determined by aggregating all subdistributions given by the tokenholders.
3) Outcomes that are expected from those roles 
Rebalancing over the whitelisted underlying DeFi protocols.
4) Specific actions/outcomes NOT intended to be possible for those roles
Should NOT be able to steal userfunds. 

A: 

___
### Q: Is the code/contract expected to comply with any EIPs? Are there specific assumptions around adhering to those EIPs that Watsons should be aware of?
A: No

___

### Q: Please list any known issues/acceptable risks that should not result in a valid finding.
A: Protocol can halt during rebalancing (distributing funds over underlying DeFi protocols on the same chain) or crosschain rebalancing (distributing funds over chains/ layers) and guardian can restart the process. 

____
### Q: Please provide links to previous audits (if any).
A: N.A.

___

### Q: Are there any off-chain mechanisms or off-chain procedures for the protocol (keeper bots, input validation expectations, etc)? 
A: Yes

They are all listed by the seccond diagram on this page: https://derby-finance.gitbook.io/derby-finance-docs/developers/architecture/cross-chain
_____

### Q: In case of external protocol integrations, are the risks of an external protocol pausing or executing an emergency withdrawal acceptable? If not, Watsons will submit issues related to these situations that can harm your protocol's functionality. 
A: Partly ACCEPTABLE. So withdrawal from an underlying DeFi protocol back to the vault should be possible.


# Audit scope


[derby-yield-optimiser @ a20f134fd711dc418ed1a947431ded800a3ebace](https://github.com/derbyfinance/derby-yield-optimiser/tree/a20f134fd711dc418ed1a947431ded800a3ebace)
- [derby-yield-optimiser/contracts/Controller.sol](derby-yield-optimiser/contracts/Controller.sol)
- [derby-yield-optimiser/contracts/DerbyToken.sol](derby-yield-optimiser/contracts/DerbyToken.sol)
- [derby-yield-optimiser/contracts/Game.sol](derby-yield-optimiser/contracts/Game.sol)
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

Derby Finance is a community powered yield optimizer that diversifies its exposure over a wide variety of DeFi yield opportunities on different EVM chains and layer 2s. It does this by offering vaults which own underlying Liquidity Pool (LP) Tokens from other DeFi protocols. 

