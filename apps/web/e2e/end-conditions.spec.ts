import { test, expect } from '@playwright/test';
import { setupGame, answerOrdre, goNext, uniquePseudo } from './helpers';

test('fin de partie assouplie : bouton "Terminer la partie" disponible dès le 1er round, en mode Limite de points', async ({ page }) => {
  const pseudoA = uniquePseudo('endPtsA');
  const pseudoB = uniquePseudo('endPtsB');

  // Auparavant (v1), "Terminer la partie" n'existait qu'en mode Arrêt manuel. En v2
  // (GAME_DESIGN_V2.md §4.1), le bouton est unifié et visible quelle que soit la condition
  // de fin choisie, y compris "Limite de points".
  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], targetScore: 30 });
  await expect(page.getByRole('button', { name: 'Terminer la partie' })).toBeVisible();
});

test('fin de partie assouplie : arrêt en cours de manche annule la manche incomplète (score revient au dernier tour complet)', async ({ page }) => {
  const pseudoA = uniquePseudo('endMidA');
  const pseudoB = uniquePseudo('endMidB');

  // "Terminer la partie" déclenche un window.confirm() : sans listener, Playwright le
  // dismiss (annule) par défaut plutôt que de l'accepter.
  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

  // Termine la manche 1 complète (v2.1 : une manche = une question, tous les joueurs répondent).
  await answerOrdre(page, pseudoA, 'Heure');
  await answerOrdre(page, pseudoB, 'Jour');
  await goNext(page);
  // Passe la transition croisée + choix de catégorie -> entame la manche 2.
  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await page.locator('.category-pick__option').first().click();
  await page.getByRole('button', { name: 'Valider la catégorie' }).click();
  await expect(page.getByText(/Manche 2/)).toBeVisible();

  // Arrête PENDANT la manche 2 (A répond, B pas encore) : la manche 2, incomplète, doit être
  // intégralement annulée (GAME_DESIGN_V2.md §4.2 règle 2) — y compris les points déjà
  // marqués par A sur cette manche.
  await answerOrdre(page, pseudoA, 'Heure');
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  await expect(page.getByRole('heading', { name: /remporte la partie|Match nul|sont à égalité en tête/ })).toBeVisible({ timeout: 10000 });
  // Le résultat vient bien du serveur (pas d'annulation de partie ici : manche 1 complète
  // existe déjà, donc partie terminée normalement au dernier tour complet).
  await expect(page.getByText('Score final').first()).toBeVisible();
});

test('fin de partie assouplie : arrêt en 1ère manche incomplète annule la partie entière (retour accueil avec message)', async ({ page }) => {
  const pseudoA = uniquePseudo('endFirstA');
  const pseudoB = uniquePseudo('endFirstB');

  page.on('dialog', (dialog) => dialog.accept());

  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

  // A répond à la 1ère question de la manche 1, B n'a pas encore répondu : arrêt ici veut
  // dire qu'aucune manche n'a jamais été complète (GAME_DESIGN_V2.md §4.2 règle 4).
  await answerOrdre(page, pseudoA, 'Heure');
  await page.getByRole('button', { name: 'Terminer la partie' }).click();

  // Partie annulée : pas d'écran de fin classé, retour direct à l'accueil avec message
  // explicite (API_CONTRACT.md : réponse `{ cancelled: true, players: [] }`).
  await expect(page.getByText('Partie interrompue avant la fin de la 1ère manche')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jouer' })).toBeVisible();
});
