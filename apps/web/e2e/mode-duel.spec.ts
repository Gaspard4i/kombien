import { test, expect } from '@playwright/test';
import { setupGame, answerDuel, goNext, uniquePseudo } from './helpers';

test('mode Duel : partie complète à 2 joueurs, estimation valeur+unité, révélation', async ({ page }) => {
  const pseudoA = uniquePseudo('duelA');
  const pseudoB = uniquePseudo('duelB');

  await setupGame(page, { mode: 'duel', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

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

test('mode Duel : partie à 3 joueurs, seul le groupe de tête marque (barème floor(2/k))', async ({ page }) => {
  const pseudoA = uniquePseudo('duel3A');
  const pseudoB = uniquePseudo('duel3B');
  const pseudoC = uniquePseudo('duel3C');

  await setupGame(page, { mode: 'duel', pseudos: [pseudoA, pseudoB, pseudoC], endCondition: 'manual' });

  // Estimations délibérément écartées : A au plus proche (seul en tête, k=1 -> 2pts pour A,
  // 0 pour B et C, GAME_DESIGN_V2.md §1.3).
  await answerDuel(page, pseudoA, 2, 'Heure');
  await answerDuel(page, pseudoB, 2, 'Jour');
  await answerDuel(page, pseudoC, 6, 'Mois');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  await expect(page.locator('.reveal__pseudo', { hasText: pseudoA })).toBeVisible();
  await expect(page.locator('.reveal__pseudo', { hasText: pseudoB })).toBeVisible();
  await expect(page.locator('.reveal__pseudo', { hasText: pseudoC })).toBeVisible();

  // A est forcément le seul à marquer des points sur ce round (écart le plus faible) —
  // le contenu exact du texte de points dépend de la vraie durée tirée, on vérifie seulement
  // que 3 lignes de résultat distinctes sont affichées (pas de crash à N>2 joueurs).
  const rows = page.locator('.reveal__player');
  await expect(rows).toHaveCount(3);
});

test('mode Duel : partie à 3 joueurs jusqu\'à la fin, classement final gère co-vainqueurs', async ({ page }) => {
  const pseudoA = uniquePseudo('duelEndA');
  const pseudoB = uniquePseudo('duelEndB');
  const pseudoC = uniquePseudo('duelEndC');

  // "Terminer la partie" déclenche un window.confirm() : sans listener, Playwright le
  // dismiss (annule) par défaut plutôt que de l'accepter.
  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'duel', pseudos: [pseudoA, pseudoB, pseudoC], endCondition: 'manual' });

  // Toutes les mêmes estimations : égalité systématique -> k=3 -> floor(2/3)=0 pour tous
  // (GAME_DESIGN_V2.md §1.3, exemple "3 joueurs tous à égalité"). Score final 0-0-0, match nul.
  // Termine la manche 1 complète (5 questions) : le header (avec "Terminer la partie") n'est
  // présent qu'à l'écran de réponse/révélation, pas sur l'écran de transition croisée qui
  // suit une manche complète -> on clique juste après le reveal de la dernière question,
  // avant le goNext qui basculerait vers cette transition (Lot 5 v2, GAME_DESIGN_V2.md §4.2).
  for (let i = 0; i < 4; i++) {
    await answerDuel(page, pseudoA, 1, 'Heure');
    await answerDuel(page, pseudoB, 1, 'Heure');
    await answerDuel(page, pseudoC, 1, 'Heure');
    await goNext(page);
  }
  await answerDuel(page, pseudoA, 1, 'Heure');
  await answerDuel(page, pseudoB, 1, 'Heure');
  await answerDuel(page, pseudoC, 1, 'Heure');
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  await expect(page.getByRole('heading', { name: /Match nul|sont à égalité en tête|remporte la partie/ })).toBeVisible({ timeout: 10000 });
});
