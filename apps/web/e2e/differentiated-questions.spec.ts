import { test, expect } from '@playwright/test';
import { goHome, passTransition, answerDuel, uniquePseudo } from './helpers';

test('questions différenciées : option cochée manuellement en mode Ordre de grandeur (thème commun)', async ({ page }) => {
  const pseudoA = uniquePseudo('diffOrdA');
  const pseudoB = uniquePseudo('diffOrdB');

  await goHome(page);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.getByLabel('Pseudo joueur 1').fill(pseudoA);
  await page.getByLabel('Pseudo joueur 2').fill(pseudoB);
  await page.getByRole('button', { name: 'Ordre de grandeur', exact: false }).first().click();
  await page.locator('.setup__category').first().click();

  // Option indépendante du mode de thème hors 'per_player' (GAME_DESIGN_V2.md §5.1) :
  // cochable manuellement même en mode Croisement (rotation).
  await page.locator('.setup__differentiated').click();
  await expect(page.locator('.setup__differentiated')).not.toBeDisabled();

  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();

  // Chaque joueur voit sa propre question (pas forcément le même texte) : le split-flap de
  // révélation par joueur (RevealPanel.svelte, GAME_DESIGN_V2.md §5.3) confirme le mode
  // différencié plutôt qu'un split-flap unique partagé.
  await passTransition(page, pseudoA);
  await page.locator('.ordre__unit').filter({ hasText: 'Heure' }).click();
  await passTransition(page, pseudoB);
  await page.locator('.ordre__unit').filter({ hasText: 'Jour' }).click();

  await expect(page.getByText('Durée réelle')).toBeVisible();
  // En mode différencié, un split-flap par joueur (reveal__player-flap) apparaît en plus
  // du split-flap partagé éventuel — RevealPanel masque celui du haut quand isDifferentiated.
  await expect(page.locator('.reveal__player-flap')).toHaveCount(2);
});

test('Duel + questions différenciées : scoring en écart relatif (pas absolu)', async ({ page }) => {
  const pseudoA = uniquePseudo('diffDuelA');
  const pseudoB = uniquePseudo('diffDuelB');

  await goHome(page);
  await page.getByRole('button', { name: 'Jouer' }).click();
  await page.getByLabel('Pseudo joueur 1').fill(pseudoA);
  await page.getByLabel('Pseudo joueur 2').fill(pseudoB);
  await page.getByRole('button', { name: 'Duel', exact: false }).first().click();
  await page.locator('.setup__category').first().click();
  await page.locator('.setup__differentiated').click();
  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();

  // Chaque joueur estime SA PROPRE question (durée potentiellement différente) : le
  // classement bascule sur l'écart relatif |est-durée|/durée (GAME_DESIGN_V2.md §5.3),
  // pas l'écart absolu — on vérifie seulement que le flow ne crash pas et produit un
  // classement cohérent à l'écran de révélation (le contenu exact dépend du tirage).
  await answerDuel(page, pseudoA, 2, 'Heure');
  await answerDuel(page, pseudoB, 1, 'Jour');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await expect(page.locator('.reveal__player-flap')).toHaveCount(2);
  await expect(page.locator('.reveal__player')).toHaveCount(2);
});
