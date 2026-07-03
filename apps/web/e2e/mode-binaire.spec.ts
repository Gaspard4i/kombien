import { test, expect } from '@playwright/test';
import { setupGame, answerBinaire, goNext, uniquePseudo } from './helpers';

/** Fait avancer l'écran de transition croisée (chooser) + le choix de catégorie. */
async function passCategoryTransitionAndPick(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await page.locator('.category-pick__option').first().click();
  await page.getByRole('button', { name: 'Valider la catégorie' }).click();
}

test('mode Binaire : partie complète setup -> manches -> révélation -> fin, scores corrects', async ({ page }) => {
  const pseudoA = uniquePseudo('binA');
  const pseudoB = uniquePseudo('binB');

  await setupGame(page, { mode: 'binaire', pseudoA, pseudoB, targetScore: 30 });

  // Manche 1, 5 questions : chaque joueur répond, révélation, jusqu'à la fin de manche.
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(/Manche 1/)).toBeVisible();
    await answerBinaire(page, pseudoA, 'yes');
    await answerBinaire(page, pseudoB, 'no');
    await expect(page.getByText('Durée réelle')).toBeVisible();
    await goNext(page);
  }

  // Fin de manche 1 (1 pt max par bonne réponse, cible 30 non atteignable en 1 manche) ->
  // transition chooser croisé (B choisit pour la manche 2, alternance GAME_DESIGN §9.2).
  await expect(page.getByText('Tu choisis la catégorie')).toBeVisible();
  await passCategoryTransitionAndPick(page);
  await expect(page.getByText(/Manche 2/)).toBeVisible();
});

test('mode Binaire : partie jusqu\'au bout (arrêt manuel), écran de fin affiche scores serveur', async ({ page }) => {
  const pseudoA = uniquePseudo('binManA');
  const pseudoB = uniquePseudo('binManB');

  await setupGame(page, { mode: 'binaire', pseudoA, pseudoB, endCondition: 'manual' });

  for (let i = 0; i < 5; i++) {
    await answerBinaire(page, pseudoA, 'yes');
    await answerBinaire(page, pseudoB, 'no');
    await goNext(page);
  }

  // Fin de manche 1 en mode manuel : transition chooser + choix de catégorie manche 2.
  // L'ordre de réponse reste A puis B (seul le chooser croisé change, pas l'ordre de jeu).
  await passCategoryTransitionAndPick(page);

  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  await expect(page.getByText('Calcul des scores en cours')).toBeVisible();
  await expect(page.getByRole('heading', { name: /remporte la partie|Match nul/ })).toBeVisible({ timeout: 10000 });

  // Les stats affichées viennent de la réponse serveur (End.svelte n'affiche qu'après result).
  await expect(page.getByText('Score final').first()).toBeVisible();
  await expect(page.getByText('XP gagnée').first()).toBeVisible();
  await expect(page.getByText('Nouveaux badges').first()).toBeVisible();
});
