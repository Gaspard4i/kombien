import { test, expect } from '@playwright/test';
import { uniquePseudo } from './helpers';

// Secret admin du .env local de test QA (voir infra/.env, jamais commité). Fourni via variable
// d'env pour ne jamais committer de secret dans les specs.
const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? '';

test.skip(!ADMIN_SECRET, 'E2E_ADMIN_SECRET non fourni : specs admin ignorées.');

test('admin : mauvais mot de passe rejeté avec message explicite', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('Modération')).toBeVisible();
  await page.getByLabel('Mot de passe admin').fill('mot-de-passe-invalide');
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Mot de passe incorrect')).toBeVisible();
});

test('admin : contribution soumise apparaît en attente, approbation la fait disparaître de la liste', async ({ page }) => {
  // 1. Soumet une question via l'écran public de contribution (status pending par défaut).
  await page.goto('/');
  await page.getByRole('button', { name: 'Proposer une question' }).click();
  const questionText = `Question e2e admin ${uniquePseudo('')}`;
  await page.getByLabel('Question (français)').fill(questionText);
  await page.getByLabel('Durée réelle').fill('42');
  await page.getByLabel('Unité').selectOption('minute');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page.getByText('Ta question est en attente de validation')).toBeVisible();

  // 2. Accède à l'admin, déverrouille, retrouve la question en attente.
  await page.goto('/admin');
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Questions en attente')).toBeVisible();

  const questionCard = page.locator('.admin__list > *', { hasText: questionText });
  await expect(questionCard).toBeVisible();

  // 3. Approuve : la carte disparaît de la liste des pending.
  await questionCard.getByRole('button', { name: 'Approuver' }).click();
  await expect(questionCard).toHaveCount(0);
});

test('admin : rejeter une question la retire de la liste des pending', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Proposer une question' }).click();
  const questionText = `Question e2e reject ${uniquePseudo('')}`;
  await page.getByLabel('Question (français)').fill(questionText);
  await page.getByLabel('Durée réelle').fill('10');
  await page.getByLabel('Unité').selectOption('minute');
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();

  await page.goto('/admin');
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();

  const questionCard = page.locator('.admin__list > *', { hasText: questionText });
  await expect(questionCard).toBeVisible();
  await questionCard.getByRole('button', { name: 'Rejeter' }).click();
  await expect(questionCard).toHaveCount(0);
});
