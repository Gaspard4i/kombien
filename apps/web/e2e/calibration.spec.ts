import { test, expect } from '@playwright/test';
import { setupGame, passTransition, uniquePseudo } from './helpers';

test('calibration : phase de 5 questions par joueur s\'exécute avant la 1ère manche Binaire', async ({ page }) => {
  const pseudoA = uniquePseudo('calA');
  const pseudoB = uniquePseudo('calB');

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB] });

  await expect(page.getByRole('heading', { name: 'Calibration' })).toBeVisible();
  await page.getByRole('button', { name: 'Commencer la calibration' }).click();

  // Joueur A : 5 questions de calibration, aucun score/streak affiché (étalonnage pur,
  // GAME_DESIGN_V2.md §3.1).
  await passTransition(page, pseudoA);
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(new RegExp(`Question ${i + 1} / 5`))).toBeVisible();
    await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
  }

  // Transition vers le joueur B (2e calibration indépendante, GAME_DESIGN_V2.md §3.5).
  await passTransition(page, pseudoB);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'NON, PAS LONGTEMPS' }).click();
  }

  // Calibration terminée pour les 2 joueurs -> bascule sur la 1ère manche de jeu normale.
  await expect(page.getByText(/Manche 1/)).toBeVisible();
});

test('calibration : le seuil calibré est utilisé au scoring (deux joueurs peuvent diverger sur la même question)', async ({ page, request }) => {
  const pseudoA = uniquePseudo('calThA');
  const pseudoB = uniquePseudo('calThB');

  // "Terminer la partie" déclenche un window.confirm() : sans listener, Playwright le
  // dismiss (annule) par défaut plutôt que de l'accepter.
  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await page.getByRole('button', { name: 'Commencer la calibration' }).click();

  // A répond "pas longtemps" à tout -> seuil extrapolé au double de sa plus longue réponse
  // "pas longtemps" (repli GAME_DESIGN_V2.md §3.4), donc un seuil TRÈS bas : presque tout
  // lui paraîtra "longtemps" en jeu.
  await passTransition(page, pseudoA);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'NON, PAS LONGTEMPS' }).click();
  }

  // B répond "longtemps" à tout -> seuil extrapolé très haut (repli symétrique) : presque
  // tout lui paraîtra "pas longtemps" en jeu.
  await passTransition(page, pseudoB);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
  }

  await expect(page.getByText(/Manche 1/)).toBeVisible();

  // v2.1 : une manche = une question -> la manche 1 est déjà complète après cette seule
  // question (A répond "longtemps", cohérent avec son seuil bas ; B répond "pas longtemps",
  // cohérent avec son seuil haut) -> les deux devraient être jugés corrects par leur seuil
  // individuel respectif (vérification faite sur l'écran de fin, seule source de vérité
  // serveur — API_CONTRACT.md POST /games).
  await passTransition(page, pseudoA);
  await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
  await passTransition(page, pseudoB);
  await page.getByRole('button', { name: 'NON, PAS LONGTEMPS' }).click();

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la partie' }).click();
  await expect(page.getByText('Score final').first()).toBeVisible({ timeout: 10000 });
  // Les deux joueurs ont un score > 0 (chacun jugé "correct" selon SON seuil calibré, pas
  // un seuil de catégorie unique qui aurait donné un verdict identique aux deux).
  const scores = await page.locator('.end__score-flap').allTextContents();
  expect(scores.length).toBe(2);
});
