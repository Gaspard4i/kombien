import { test, expect } from '@playwright/test';
import { setupGame, answerBinaire, uniquePseudo } from './helpers';

test('signalement : reporter une question depuis l\'écran de révélation confirme l\'enregistrement', async ({ page }) => {
  const pseudoA = uniquePseudo('repA');
  const pseudoB = uniquePseudo('repB');

  await setupGame(page, { mode: 'binaire', pseudoA, pseudoB, endCondition: 'manual' });
  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await page.getByRole('button', { name: 'Signaler cette question' }).click();
  await expect(page.getByText('Merci, le signalement a été enregistré')).toBeVisible();
});
