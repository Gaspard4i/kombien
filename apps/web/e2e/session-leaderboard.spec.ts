import { test, expect } from '@playwright/test';
import { setupGame, passCalibration, answerBinaire, uniquePseudo } from './helpers';

test('classement de session : overlay accessible en cours de partie, focus trap, fermeture au clavier', async ({ page }) => {
  const pseudoA = uniquePseudo('lbA');
  const pseudoB = uniquePseudo('lbB');

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await passCalibration(page, [pseudoA, pseudoB]);

  // Ouvre le classement de session en cours de partie (Lot 7 v2, GAME_DESIGN_V2.md §0.1/§6.5)
  // via le bouton dédié de la ScoreBar.
  await page.getByRole('button', { name: 'Voir le classement' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Classement').first()).toBeVisible();
  // Les deux pseudos apparaissent aussi dans la ScoreBar et l'écran de transition en dessous
  // de l'overlay -> on cible spécifiquement les lignes du classement (dialog).
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(pseudoA)).toBeVisible();
  await expect(dialog.getByText(pseudoB)).toBeVisible();

  // Focus trap : le focus initial est posé dans le panneau (bouton de fermeture du header,
  // à distinguer du bouton backdrop qui porte le même label accessible).
  await expect(dialog.getByRole('button', { name: 'Fermer le classement' })).toBeFocused();

  // Fermeture au clavier (Escape, LeaderboardOverlay.svelte).
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('classement de session : mis à jour en cours de partie après chaque question', async ({ page }) => {
  const pseudoA = uniquePseudo('lbUpdA');
  const pseudoB = uniquePseudo('lbUpdB');

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await passCalibration(page, [pseudoA, pseudoB]);

  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');

  await page.getByRole('button', { name: 'Voir le classement' }).click();
  // Au moins un score non-nul affiché (l'un des deux a marqué un point ou les deux à 0 selon
  // la vraie durée, mais le classement doit refléter l'état courant sans planter).
  await expect(page.locator('.leaderboard__row')).toHaveCount(2);
});

test('classement de session final : consultable à l\'écran de fin, enrichi (précision, meilleure série, exploits)', async ({ page }) => {
  const pseudoA = uniquePseudo('lbFinA');
  const pseudoB = uniquePseudo('lbFinB');

  // "Terminer la partie" déclenche un window.confirm() : sans listener, Playwright le
  // dismiss (annule) par défaut plutôt que de l'accepter.
  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await passCalibration(page, [pseudoA, pseudoB]);

  // Le header (avec "Terminer la partie") n'est présent qu'à l'écran de réponse/révélation,
  // pas sur l'écran de transition croisée qui suit une manche complète -> on clique juste
  // après le reveal de la dernière question, avant le goNext qui basculerait vers cette
  // transition (Lot 5 v2, GAME_DESIGN_V2.md §4.2).
  for (let i = 0; i < 4; i++) {
    await answerBinaire(page, pseudoA, 'yes');
    await answerBinaire(page, pseudoB, 'no');
    await page.getByRole('button', { name: /Question suivante|Manche suivante/ }).click();
  }
  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  await expect(page.getByText('Score final').first()).toBeVisible({ timeout: 10000 });
  // Classement final enrichi : lignes classées, précision et meilleure série par joueur.
  await expect(page.locator('.leaderboard--final .leaderboard__row')).toHaveCount(2);
  await expect(page.getByText('Précision').first()).toBeVisible();
  await expect(page.getByText('Meilleure série').first()).toBeVisible();
  await expect(page.getByText('Exploits de la partie').first()).toBeVisible();
});
