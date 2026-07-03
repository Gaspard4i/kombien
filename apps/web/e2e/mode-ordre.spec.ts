import { test, expect } from '@playwright/test';
import { setupGame, answerOrdre, goNext, uniquePseudo } from './helpers';

test('mode Ordre de grandeur : partie complète à 2 joueurs, choix d\'unité et révélation', async ({ page }) => {
  const pseudoA = uniquePseudo('ordA');
  const pseudoB = uniquePseudo('ordB');

  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

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

test('mode Ordre de grandeur : partie à 4 joueurs (N-joueurs pass-and-play), tous répondent en boucle', async ({ page }) => {
  const pseudos = [uniquePseudo('ord4A'), uniquePseudo('ord4B'), uniquePseudo('ord4C'), uniquePseudo('ord4D')];

  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos, endCondition: 'manual' });

  await expect(page.getByText(/Manche 1/)).toBeVisible();
  await answerOrdre(page, pseudos[0]!, 'Heure');
  await answerOrdre(page, pseudos[1]!, 'Jour');
  await answerOrdre(page, pseudos[2]!, 'Minute');
  await answerOrdre(page, pseudos[3]!, 'Semaine');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  // Les 4 joueurs sont affichés à la révélation, chacun avec son propre résultat.
  for (const pseudo of pseudos) {
    await expect(page.locator('.reveal__pseudo', { hasText: pseudo })).toBeVisible();
  }
});
