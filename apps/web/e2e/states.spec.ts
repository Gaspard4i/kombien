import { test, expect } from '@playwright/test';

test('état de chargement : skeleton structuré affiché (jamais de "..." textuel)', async ({ page }) => {
  // Ralentit la réponse /categories pour donner le temps d'observer le skeleton.
  await page.route('**/categories', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).click();

  // Skeleton visible pendant le chargement des catégories (Setup.svelte : rows={3}).
  const skeleton = page.getByRole('status', { name: 'Chargement' });
  await expect(skeleton).toBeVisible();
  // Aucun texte "..." ou "loading" brut affiché à l'écran pendant le chargement.
  await expect(page.getByText('...')).toHaveCount(0);
  await expect(page.getByText(/^loading$/i)).toHaveCount(0);

  await expect(skeleton).not.toBeVisible({ timeout: 5000 });
});

test('état d\'erreur : panne réseau sur /categories affiche un message explicite (pas d\'écran blanc)', async ({ page }) => {
  await page.route('**/categories', (route) => route.abort('failed'));

  await page.goto('/');
  await page.getByRole('button', { name: 'Jouer' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Impossible de contacter le serveur')).toBeVisible();
});

test('état vide : liste de questions admin en attente vide affiche un message dédié', async ({ page }) => {
  const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET;
  test.skip(!ADMIN_SECRET, 'E2E_ADMIN_SECRET non fourni.');

  await page.route('**/admin/questions*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.goto('/admin');
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET!);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();

  await expect(page.getByText('Aucune question en attente')).toBeVisible();
});
