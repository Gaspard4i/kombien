import { test, expect } from '@playwright/test';
import { uniquePseudo } from './helpers';

test('contribution : soumettre une question sur une catégorie existante', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Proposer une question' }).click();

  await expect(page.getByText('Proposer une question')).toBeVisible();
  await page.getByLabel('Question (français)').fill(`Combien de temps dure un test e2e ${uniquePseudo('')}?`);
  await page.getByLabel('Durée réelle').fill('30');
  await page.getByLabel('Unité').selectOption('minute');
  // Catégorie existante : le select est déjà pré-rempli avec la première catégorie (onMount).

  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page.getByText('Ta question est en attente de validation')).toBeVisible();
});

test('contribution : soumettre une question avec une nouvelle catégorie (fr+en requis)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Proposer une question' }).click();

  await page.getByLabel('Question (français)').fill('Combien de temps pour dresser une nouvelle catégorie e2e ?');
  await page.getByLabel('Durée réelle').fill('15');
  await page.getByLabel('Unité').selectOption('minute');

  await page.getByRole('button', { name: 'Nouvelle catégorie' }).click();
  const suffix = uniquePseudo('');
  await page.getByLabel('Nom de la catégorie (français)').fill(`Catégorie E2E ${suffix}`);
  await page.getByLabel('Nom de la catégorie (anglais)').fill(`E2E Category ${suffix}`);

  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page.getByText('Ta question est en attente de validation')).toBeVisible();
});

test('contribution : validation front bloque un formulaire incomplet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Proposer une question' }).click();
  await page.getByRole('button', { name: 'Envoyer la proposition' }).click();
  await expect(page.getByText('La question en français est obligatoire')).toBeVisible();
});
