import { test, expect } from '@playwright/test';
import { goHome } from './helpers';

test('i18n : bascule fr -> en -> fr, aucune chaîne en dur, persistance au reload', async ({ page }) => {
  await goHome(page);

  // Défaut fr (locale navigateur fixée à fr-FR dans playwright.config.ts).
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible();
  // Aucune clé i18n non résolue (ex: "home.play" affiché tel quel) ne doit fuiter à l'écran.
  await expect(page.getByText(/\bhome\.\w+\b/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Langue' }).click();
  await expect(page.getByRole('button', { name: 'View leaderboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suggest a question' })).toBeVisible();

  // Persistance après reload.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  // Retour fr.
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible();
});

test('i18n : setup + jeu affichés entièrement en anglais quand la langue EN est active', async ({ page }) => {
  await goHome(page);
  await page.getByRole('button', { name: 'Langue' }).click();

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText('New game')).toBeVisible();
  await expect(page.getByLabel('Player A nickname')).toBeVisible();
  await expect(page.getByText('Choose a mode')).toBeVisible();
  await expect(page.getByText('Binary')).toBeVisible();
  await expect(page.getByText('Magnitude')).toBeVisible();
  await expect(page.getByText('Duel')).toBeVisible();
});
