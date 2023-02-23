## for testing run npx hardhat node

### deploy all contracts on given network

npx hardhat --network localhost deploy

### deploy all contracts and resets the deployments from scratch

npx hardhat --network localhost deploy --reset

### deploy contracts excluding Providers

npx hardhat --network localhost deploy --tags Controller,DerbyToken,Game,Swap,MainVault,XChainController,XProvider

## Goerli vault deployment flow example

- Add deploy_vault template to deploy/localhost/ and check the contract name getters
- Change vaultName in template
- Set deployment + init settings in deploy/config file with the SAME vaultName
- npx hardhat --network goerli deploy --tags DerbyGoerliUSDC
- npx hardhat --network goerli vault_init --contract DerbyGoerliUSDC
