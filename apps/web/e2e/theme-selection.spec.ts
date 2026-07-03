import { test, expect } from '@playwright/test';
import { goHome, passTransition, answerOrdre, uniquePseudo } from './helpers';

/** Setup minimal jusqu'à l'écran de sélection de thème (mode Ordre de grandeur, pas de
 * calibration à gérer). N'utilise pas setupGame() qui ne couvre que le mode 'rotation'. */
async function setupUntilThemeSelect(page: import('@playwright/test').Page, pseudos: string[]): Promise<void> {
  await goHome(page);
  await page.getByRole('button', { name: 'Jouer' }).click();
  for (let i = 2; i < pseudos.length; i++) {
    await page.getByRole('button', { name: 'Ajouter un joueur' }).click();
  }
  for (let i = 0; i < pseudos.length; i++) {
    await page.getByLabel(`Pseudo joueur ${i + 1}`).fill(pseudos[i]!);
  }
  await page.getByRole('button', { name: 'Ordre de grandeur', exact: false }).first().click();
}

test('sélection de thèmes : mode Croisement (rotation) — comportement v1 par défaut', async ({ page }) => {
  const pseudos = [uniquePseudo('thRotA'), uniquePseudo('thRotB')];
  await setupUntilThemeSelect(page, pseudos);

  // Rotation est le mode par défaut : la grille de catégories "manche 1" reste visible
  // directement (pas d'étape de sélection supplémentaire), cf GAME_DESIGN_V2.md §2.5.
  await expect(page.getByText('Catégorie de la 1ère manche')).toBeVisible();
  await page.locator('.setup__category').first().click();
  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();
});

test('sélection de thèmes : mode Thème unique (global) — un seul thème pour toute la partie', async ({ page }) => {
  const pseudos = [uniquePseudo('thGlobA'), uniquePseudo('thGlobB')];
  await setupUntilThemeSelect(page, pseudos);

  await page.getByRole('button', { name: 'Thème unique', exact: false }).click();
  await expect(page.getByText('Choisis le thème')).toBeVisible();
  await page.locator('.theme-select__option').first().click();

  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();

  // Pas de category-pick manche après manche (pool fixe, GAME_DESIGN_V2.md §1.3) : après une
  // manche complète, la transition directe vers la manche 2 saute l'écran de choix croisé.
  await answerOrdre(page, pseudos[0]!, 'Heure');
  await answerOrdre(page, pseudos[1]!, 'Jour');
  await expect(page.getByText('Tu choisis la catégorie')).toHaveCount(0);
});

test('sélection de thèmes : mode Vote — chaque joueur vote, le plus voté s\'applique', async ({ page }) => {
  const pseudos = [uniquePseudo('thVoteA'), uniquePseudo('thVoteB')];
  await setupUntilThemeSelect(page, pseudos);

  // Le nom accessible du bouton de mode inclut sa description (pas d'aria-label dédié) :
  // "Vote" seul ne matche pas exactement -> on cible le bouton par sa classe + son titre.
  await page.locator('.theme-select__mode').filter({ hasText: 'Vote' }).click();
  await expect(page.getByText(new RegExp(`${pseudos[0]}, pour quel thème votes-tu`))).toBeVisible();
  await page.locator('.theme-select__option').first().click();
  await expect(page.getByText(new RegExp(`${pseudos[1]}, pour quel thème votes-tu`))).toBeVisible();
  await page.locator('.theme-select__option').first().click();

  // Vote unanime -> pas d'égalité, résultat annoncé immédiatement (GAME_DESIGN_V2.md §2.2).
  await expect(page.getByText(/Thème retenu :/)).toBeVisible();

  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();
});

test('sélection de thèmes : mode Multi-thèmes — union de plusieurs catégories', async ({ page }) => {
  const pseudos = [uniquePseudo('thMultiA'), uniquePseudo('thMultiB')];
  await setupUntilThemeSelect(page, pseudos);

  await page.getByRole('button', { name: 'Multi-thèmes', exact: false }).click();
  await expect(page.getByText('Choisis un ou plusieurs thèmes')).toBeVisible();
  await page.locator('.theme-select__option').nth(0).click();
  await page.locator('.theme-select__option').nth(1).click();

  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();
  // Le tag de catégorie affiché sur la question appartient à l'une des 2 sélectionnées
  // (pool fusionné, GAME_DESIGN_V2.md §2.3) : on vérifie juste qu'une question est chargée
  // sans erreur (le contenu précis dépend du tirage aléatoire).
  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await expect(page.locator('.game__question-text')).toBeVisible();
});

test('sélection de thèmes : mode Thème par joueur — force les questions différenciées', async ({ page }) => {
  const pseudos = [uniquePseudo('thPerA'), uniquePseudo('thPerB')];
  await setupUntilThemeSelect(page, pseudos);

  await page.getByRole('button', { name: 'Thème par joueur', exact: false }).click();
  // Les Cards des 2 joueurs sont affichées simultanément (pas de transition entre elles) :
  // on scope chaque sélection à la Card du joueur concerné plutôt que d'indexer globalement
  // sur .theme-select__option (qui mélangerait les options des deux joueurs).
  await expect(page.getByText(new RegExp(`Thèmes de ${pseudos[0]}`))).toBeVisible();
  await expect(page.getByText(new RegExp(`Thèmes de ${pseudos[1]}`))).toBeVisible();
  const cardA = page.locator('.card', { hasText: `Thèmes de ${pseudos[0]}` });
  const cardB = page.locator('.card', { hasText: `Thèmes de ${pseudos[1]}` });
  await cardA.locator('.theme-select__option').first().click();
  // Choisit un thème différent pour B afin de garantir des pools distincts.
  await cardB.locator('.theme-select__option').nth(1).click();

  // Questions différenciées forcées et non désactivables (GAME_DESIGN_V2.md §2.4).
  await expect(page.getByText('Obligatoire : chaque joueur a déjà son propre thème.')).toBeVisible();
  const differentiatedToggle = page.locator('.setup__differentiated');
  await expect(differentiatedToggle).toBeDisabled();

  await page.getByRole('button', { name: 'On arrête là' }).click();
  await page.getByRole('button', { name: 'Commencer la partie' }).click();
  await expect(page.getByText(/Manche 1/)).toBeVisible();
});
