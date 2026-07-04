import { test, expect } from '@playwright/test';
import { setupGame, passCalibration, answerBinaire, goNext, uniquePseudo } from './helpers';

/** Fait avancer l'écran de transition croisée (chooser) + le choix de catégorie. */
async function passCategoryTransitionAndPick(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await page.locator('.category-pick__option').first().click();
  await page.getByRole('button', { name: 'Valider la catégorie' }).click();
}

test('mode Binaire : partie complète setup -> calibration -> manche -> révélation -> manche suivante, scores corrects', async ({ page }) => {
  const pseudoA = uniquePseudo('binA');
  const pseudoB = uniquePseudo('binB');

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], targetScore: 30 });

  // Calibration obligatoire avant la 1ère manche en mode Binaire (Lot 4 v2, §3).
  await expect(page.getByRole('heading', { name: 'Calibration' })).toBeVisible();
  await passCalibration(page, [pseudoA, pseudoB]);

  // v2.1 : une manche = une question. Chaque joueur répond, révélation, classement mis à
  // jour immédiatement, puis rotation du chooser (croisement) avant la manche suivante.
  await expect(page.getByText(/Manche 1/)).toBeVisible();
  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');
  await expect(page.getByText('Durée réelle')).toBeVisible();

  // Fin de manche 1 (1 pt max par bonne réponse, cible 30 non atteignable en 1 manche) ->
  // transition chooser croisé (B choisit pour la manche 2, alternance GAME_DESIGN §9.2).
  await goNext(page);
  await expect(page.getByText('Tu choisis la catégorie')).toBeVisible();
  await passCategoryTransitionAndPick(page);
  await expect(page.getByText(/Manche 2/)).toBeVisible();
});

test('mode Binaire : partie jusqu\'au bout (arrêt manuel), écran de fin affiche scores serveur + exploits de session', async ({ page }) => {
  const pseudoA = uniquePseudo('binManA');
  const pseudoB = uniquePseudo('binManB');

  // "Terminer la partie" déclenche un window.confirm() (Game.svelte::handleStopGame) : sans
  // listener, Playwright le DISMISS par défaut (annule), pas accept -> il faut l'accepter
  // explicitement pour que la navigation vers /end ait bien lieu.
  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await passCalibration(page, [pseudoA, pseudoB]);

  // Manche 1 : réponses puis rotation chooser croisé vers la manche 2 (v2.1 : chaque manche
  // = une question, la transition catégorie suit donc directement le premier reveal).
  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');
  await goNext(page);
  await passCategoryTransitionAndPick(page);

  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  await expect(page.getByRole('heading', { name: /remporte la partie|Match nul|sont à égalité en tête/ })).toBeVisible({ timeout: 10000 });

  // Les stats affichées viennent de la réponse serveur (End.svelte n'affiche qu'après result).
  // v2 : plus d'XP/badges cumulés — remplacés par "Exploits de la partie" (session_exploits).
  await expect(page.getByText('Score final').first()).toBeVisible();
  await expect(page.getByText('Précision').first()).toBeVisible();
  await expect(page.getByText('Exploits de la partie').first()).toBeVisible();
  await expect(page.getByText('XP gagnée')).toHaveCount(0);
  await expect(page.getByText('Nouveaux badges')).toHaveCount(0);
});
