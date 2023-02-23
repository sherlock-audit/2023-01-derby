import { expect } from 'chai';
import { setupVault } from './setup';

describe('Testing VaultDeposit, unit test', async () => {
  it('Deposit, mint and return Derby LP tokens', async function () {
    const { vault, user } = await setupVault();
    await expect(() =>
      vault.connect(user).deposit(10_000 * 1e6, user.address),
    ).to.changeTokenBalance(vault, user, 10_000 * 1e6);

    // mocking exchangerate to 0.9
    await vault.setExchangeRateTEST(0.9 * 1e6);

    let expectedLPTokens = Math.trunc((10_000 / 0.9) * 1e6);
    await expect(() =>
      vault.connect(user).deposit(10_000 * 1e6, user.address),
    ).to.changeTokenBalance(vault, user, expectedLPTokens);

    // mocking exchangerate to 1.321
    await vault.setExchangeRateTEST(1.321 * 1e6);

    expectedLPTokens = Math.trunc((10_000 / 1.321) * 1e6);
    await expect(() =>
      vault.connect(user).deposit(10_000 * 1e6, user.address),
    ).to.changeTokenBalance(vault, user, expectedLPTokens);
  });

  it('Should not be able to deposit when vault is off', async function () {
    const { vault, user } = await setupVault();
    await vault.toggleVaultOnOffTEST(true);

    await expect(vault.connect(user).deposit(10_000 * 1e6, user.address)).to.be.revertedWith(
      'Vault is off',
    );
  });

  it('Test training state', async function () {
    const { vault, user, guardian } = await setupVault();
    await vault.connect(guardian).setTraining(true);
    // set maxTrainingDeposit to 10k
    await vault.connect(guardian).setTrainingDeposit(10_000 * 1e6);

    // not whitelisted
    await expect(vault.connect(user).deposit(5_000 * 1e6, user.address)).to.be.revertedWith('');

    await vault.connect(guardian).addToWhitelist(user.address);

    await expect(() =>
      vault.connect(user).deposit(6_000 * 1e6, user.address),
    ).to.changeTokenBalance(vault, user, 6_000 * 1e6);

    // max deposit of 10k reached
    await expect(vault.connect(user).deposit(6_000 * 1e6, user.address)).to.be.revertedWith('');

    // User will have a total of 9k LPs, so should be fine
    await expect(() =>
      vault.connect(user).deposit(3_000 * 1e6, user.address),
    ).to.changeTokenBalance(vault, user, 3_000 * 1e6);
  });
});
