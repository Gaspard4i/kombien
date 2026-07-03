import { test, expect } from '@playwright/test';
import { setupGame, answerBinaire, goNext, passTransition, uniquePseudo, fetchCategoryWithQuestions } from './helpers';

test('leaderboard : accessible depuis l\'accueil, onglets global/catégorie fonctionnels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Voir le classement' }).click();
  await expect(page.getByText('Classement')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Général' })).toBeVisible();
  await page.getByRole('button', { name: 'Par catégorie' }).click();
  // Le sélecteur de catégorie apparaît (grille de boutons de catégories).
  await expect(page.locator('.leaderboard__category-select')).toBeVisible();
});

test('profil : recherche par pseudo, badge débloqué après une partie visible sur le profil', async ({ page }) => {
  const pseudoA = uniquePseudo('gamA');
  const pseudoB = uniquePseudo('gamB');

  await setupGame(page, { mode: 'binaire', pseudoA, pseudoB, endCondition: 'manual' });
  await answerBinaire(page, pseudoA, 'yes');
  await answerBinaire(page, pseudoB, 'no');
  await page.getByRole('button', { name: 'Terminer la partie' }).click();
  await page.getByText('Score final').first().waitFor({ state: 'visible', timeout: 10000 });

  await page.getByRole('button', { name: 'Retour à l\'accueil' }).click();
  await page.getByRole('button', { name: 'Voir le classement' }).click();
  // Le classement (top 20 par XP) ne contient pas forcément pseudoA (beaucoup de profils de
  // test s'accumulent) : on entre dans Profile via n'importe quel pseudo affiché, puis on
  // utilise le champ de recherche (accessible uniquement depuis Profile, pas de lien direct
  // Leaderboard -> recherche libre) pour atteindre pseudoA précisément.
  await page.locator('.leaderboard__pseudo').first().click();
  await expect(page.getByLabel('Rechercher un pseudo')).toBeVisible();
  await page.getByLabel('Rechercher un pseudo').fill(pseudoA);
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page.getByText(`Profil de ${pseudoA}`)).toBeVisible();
  await expect(page.getByText('Parties jouées')).toBeVisible();
  // Badge "Première fois" débloqué à la première partie terminée.
  await expect(page.locator('.profile__badge--unlocked', { hasText: 'Première fois' })).toBeVisible();
});

test('profil : pseudo inexistant affiche un message explicite (pas d\'écran blanc)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Voir le classement' }).click();
  // Profile n'est atteignable qu'en cliquant un pseudo déjà classé (pas de lien "mon profil"
  // ni de recherche libre depuis Leaderboard) : on y entre une première fois puis on cherche
  // le pseudo inexistant depuis le champ de recherche interne à Profile.
  await page.locator('.leaderboard__pseudo').first().click();
  await page.getByLabel('Rechercher un pseudo').fill(`inexistant${uniquePseudo('')}`);
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await expect(page.getByText('Ce joueur n\'existe pas.')).toBeVisible();
});

test('streak : le multiplicateur x2 apparaît après 3 bonnes réponses consécutives', async ({ page, request }) => {
  test.setTimeout(60000);
  // Récupère les vraies durées de la catégorie (celle avec le plus de questions "longtemps")
  // pour répondre correctement à chaque question réellement affichée (GAME_DESIGN.md §3).
  const { category, questions } = await fetchCategoryWithQuestions(request, 50);
  const durationByText = new Map(questions.map((q) => [q.text_fr, q.duration_seconds]));

  const pseudoA = uniquePseudo('strA');
  const pseudoB = uniquePseudo('strB');
  await setupGame(page, { mode: 'binaire', pseudoA, pseudoB, endCondition: 'manual', categoryNameFr: category.name_fr });

  let streak = 0;
  let guardRounds = 0;
  while (streak < 3 && guardRounds < 20) {
    guardRounds += 1;
    // A répond en premier à chaque question : on passe sa transition puis on lit le texte
    // affiché (la Card de question n'existe qu'une fois la transition passée).
    await passTransition(page, pseudoA);
    const questionText = await page.locator('.game__question-text').textContent();
    const duration = durationByText.get(questionText?.trim() ?? '');
    const isLong = (duration ?? 0) >= category.threshold_seconds;

    await page.getByRole('button', { name: isLong ? 'OUI, LONGTEMPS' : 'NON, PAS LONGTEMPS' }).click();
    await answerBinaire(page, pseudoB, 'no');

    streak = isLong ? streak + 1 : 0;
    if (streak >= 3) break;
    await goNext(page);

    // Fin de manche (5 questions) : passe la transition croisée + reconfirme la même
    // catégorie pour garder des durées connues côté test. isVisible() sans attente peut
    // rater le rendu juste après goNext() -> on attend explicitement avec un court timeout.
    const categoryTransition = page.getByText('Tu choisis la catégorie');
    const isRoundEnd = await categoryTransition
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (isRoundEnd) {
      await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
      await page.locator('.category-pick__option', { hasText: category.name_fr }).click();
      await page.getByRole('button', { name: 'Valider la catégorie' }).click();
    }
  }

  // Streak de A a atteint au moins 3 -> multiplicateur x2 ou x3 visible (GAME_DESIGN.md §6.2).
  await expect(page.getByText(/×2|×3/).first()).toBeVisible();
});
