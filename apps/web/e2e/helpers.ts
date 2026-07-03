import type { APIRequestContext, Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE_URL ?? 'http://localhost:8014';

export interface CategoryInfo {
  id: number;
  slug: string;
  name_fr: string;
  threshold_seconds: number;
}

/** Catégorie + questions réelles (avec duration_seconds) pour construire des réponses
 * déterministes (ex: streak garanti) plutôt que de deviner à l'aveugle. Choisit, parmi
 * toutes les catégories, celle avec le plus de questions "longtemps" (>= threshold) pour
 * maximiser les chances d'obtenir 3 bonnes réponses consécutives en peu de manches. */
export async function fetchCategoryWithQuestions(
  request: APIRequestContext,
  count = 50,
): Promise<{ category: CategoryInfo; questions: { text_fr: string; duration_seconds: number }[] }> {
  const categoriesRes = await request.get(`${API_BASE}/categories`);
  const categories: CategoryInfo[] = await categoriesRes.json();

  const withQuestions = await Promise.all(
    categories.map(async (category) => {
      const res = await request.get(`${API_BASE}/categories/${category.slug}/questions?count=${count}`);
      const questions: { text_fr: string; duration_seconds: number }[] = await res.json();
      const longCount = questions.filter((q) => q.duration_seconds >= category.threshold_seconds).length;
      return { category, questions, longCount };
    }),
  );

  const best = withQuestions.sort((a, b) => b.longCount - a.longCount)[0];
  return { category: best.category, questions: best.questions };
}

/** Pseudos uniques par test pour éviter les collisions entre specs qui tournent dans le
 * même navigateur (localStorage brouillon bulk-create, notamment). */
export function uniquePseudo(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export async function goHome(page: Page): Promise<void> {
  await page.goto('/');
}

interface SetupOptions {
  mode: 'binaire' | 'ordre_de_grandeur' | 'duel';
  /** Pseudos des joueurs, dans l'ordre (2 à 8, cf GAME_DESIGN_V2.md §1.3). */
  pseudos: string[];
  targetScore?: 30 | 50 | 100;
  endCondition?: 'points' | 'manual';
  /** Nom affiché de la catégorie à sélectionner (name_fr). Sinon la 1re de la grille.
   * Seulement pertinent en mode de thème 'rotation' (défaut du Setup). */
  categoryNameFr?: string;
}

const MODE_LABEL: Record<SetupOptions['mode'], string> = {
  binaire: 'Binaire',
  ordre_de_grandeur: 'Ordre de grandeur',
  duel: 'Duel',
};

/** Remplit l'écran Setup (mode rotation par défaut, N pseudos) et lance la partie
 * (jusqu'à l'écran de jeu — calibration si Binaire, sinon manche 1 direct). */
export async function setupGame(page: Page, options: SetupOptions): Promise<void> {
  await goHome(page);
  await page.getByRole('button', { name: 'Jouer' }).click();

  // 2 champs pseudo présents par défaut ; on ajoute les slots manquants pour N > 2.
  for (let i = 2; i < options.pseudos.length; i++) {
    await page.getByRole('button', { name: 'Ajouter un joueur' }).click();
  }

  for (let i = 0; i < options.pseudos.length; i++) {
    await page.getByLabel(`Pseudo joueur ${i + 1}`).fill(options.pseudos[i]!);
  }

  await page.getByRole('button', { name: MODE_LABEL[options.mode], exact: false }).first().click();

  if (options.categoryNameFr) {
    await page.locator('.setup__category').filter({ hasText: options.categoryNameFr }).click();
  } else {
    // Première catégorie disponible (peu importe laquelle pour les tests de flow générique).
    await page.locator('.setup__category').first().click();
  }

  if (options.endCondition === 'manual') {
    await page.getByRole('button', { name: 'On arrête là' }).click();
  } else if (options.targetScore) {
    await page.getByRole('button', { name: String(options.targetScore), exact: true }).click();
  }

  await page.getByRole('button', { name: 'Commencer la partie' }).click();
}

/** Passe l'écran de transition pass-and-play ("JE SUIS PRÊT · pseudo"). */
export async function passTransition(page: Page, pseudo: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`JE SUIS PRÊT.*${escapeRegExp(pseudo)}`) }).click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Passe la phase de calibration (Lot 4 v2) pour tous les joueurs : répond "OUI" aux
 * `answersYes` premières questions de calibration, "NON" aux suivantes, pour chacun.
 * À appeler juste après setupGame() en mode Binaire, avant la 1ère manche. */
export async function passCalibration(page: Page, pseudos: string[], questionCount = 5): Promise<void> {
  await page.getByRole('button', { name: 'Commencer la calibration' }).click();
  for (const pseudo of pseudos) {
    await passTransition(page, pseudo);
    for (let i = 0; i < questionCount; i++) {
      // Réponse arbitraire cohérente (repli sur le seuil de catégorie si incohérent, cf
      // GAME_DESIGN_V2.md §3.4) : le contenu précis importe peu pour les tests de flow,
      // seul compte que la phase se termine et débouche sur la 1ère manche.
      await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
    }
  }
}

/** Répond une question en mode Binaire pour le joueur courant (transition -> réponse -> reveal si dernier). */
export async function answerBinaire(page: Page, pseudo: string, answer: 'yes' | 'no'): Promise<void> {
  await passTransition(page, pseudo);
  const label = answer === 'yes' ? 'OUI, LONGTEMPS' : 'NON, PAS LONGTEMPS';
  await page.getByRole('button', { name: label }).click();
}

/** Répond une question en mode Ordre de grandeur (choix d'une unité, ex: "Heure"). */
export async function answerOrdre(page: Page, pseudo: string, unitLabel: string): Promise<void> {
  await passTransition(page, pseudo);
  await page.locator('.ordre__unit').filter({ hasText: unitLabel }).click();
}

/** Saisit une estimation Duel (valeur + unité) pour le joueur courant. */
export async function answerDuel(page: Page, pseudo: string, value: number, unitLabel: string): Promise<void> {
  await passTransition(page, pseudo);
  await page.getByLabel('Valeur').fill(String(value));
  await page.locator('.duel__unit').filter({ hasText: unitLabel }).click();
  await page.getByRole('button', { name: 'Valider' }).click();
}

/** Depuis l'écran de révélation, passe à la question/manche suivante. */
export async function goNext(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /Question suivante|Manche suivante/ });
  await button.click();
}
