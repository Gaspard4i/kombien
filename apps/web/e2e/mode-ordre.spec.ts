import { test, expect } from '@playwright/test';
import { setupGame, answerOrdre, goNext, uniquePseudo } from './helpers';

test('mode Ordre de grandeur : partie complète, choix d\'unité et révélation', async ({ page }) => {
  const pseudoA = uniquePseudo('ordA');
  const pseudoB = uniquePseudo('ordB');

  await setupGame(page, { mode: 'ordre_de_grandeur', pseudoA, pseudoB, endCondition: 'manual' });

  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(/Manche 1/)).toBeVisible();
    await answerOrdre(page, pseudoA, 'Heure');
    await answerOrdre(page, pseudoB, 'Jour');
    await expect(page.getByText('Durée réelle')).toBeVisible();
    // Le résultat (bonne/mauvaise réponse) et les points provisoires sont affichés par joueur.
    await expect(page.locator('.reveal__pseudo', { hasText: pseudoA })).toBeVisible();
    await expect(page.locator('.reveal__pseudo', { hasText: pseudoB })).toBeVisible();
    await goNext(page);
  }

  await expect(page.getByText('Tu choisis la catégorie')).toBeVisible();
});
