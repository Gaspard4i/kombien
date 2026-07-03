import { test, expect } from '@playwright/test';
import { setupGame, answerDuel, goNext, uniquePseudo } from './helpers';

test('mode Duel : partie complète, estimation valeur+unité pour chaque joueur, révélation', async ({ page }) => {
  const pseudoA = uniquePseudo('duelA');
  const pseudoB = uniquePseudo('duelB');

  await setupGame(page, { mode: 'duel', pseudoA, pseudoB, endCondition: 'manual' });

  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(/Manche 1/)).toBeVisible();
    // Duel : les deux joueurs saisissent leur estimation avant la révélation commune
    // (contrairement à Binaire/Ordre, il n'y a pas de reveal intermédiaire par joueur).
    await answerDuel(page, pseudoA, 2, 'Heure');
    await answerDuel(page, pseudoB, 3, 'Heure');
    await expect(page.getByText('Durée réelle')).toBeVisible();
    await expect(page.locator('.reveal__pseudo', { hasText: pseudoA })).toBeVisible();
    await expect(page.locator('.reveal__pseudo', { hasText: pseudoB })).toBeVisible();
    await goNext(page);
  }

  await expect(page.getByText('Tu choisis la catégorie')).toBeVisible();
});
