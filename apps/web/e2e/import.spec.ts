import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { uniquePseudo } from './helpers';

const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? '';
test.skip(!ADMIN_SECRET, 'E2E_ADMIN_SECRET non fourni : specs import ignorées.');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALID_CSV = path.join(HERE, 'fixtures', 'import-valid.csv');
const INVALID_CSV = path.join(HERE, 'fixtures', 'import-invalid.csv');

async function unlockAdminAndGoToImport(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin');
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.getByRole('button', { name: 'Importer des questions' }).click();
  await expect(page.getByText('Import de questions')).toBeVisible();
}

test('import de masse : téléchargement du template CSV', async ({ page }) => {
  await unlockAdminAndGoToImport(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Modèle CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});

test('import de masse : CSV valide -> toutes les lignes importées en pending', async ({ page }) => {
  await unlockAdminAndGoToImport(page);
  await page.setInputFiles('#import-file', VALID_CSV);
  await page.getByRole('button', { name: 'Importer', exact: true }).click();

  await expect(page.getByText(/2 question\(s\) importée\(s\) sur 2, 0 rejetée\(s\)/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Lignes rejetées')).toHaveCount(0);
});

test('import de masse : CSV invalide -> rapport d\'erreurs ligne à ligne, lignes valides quand même importées', async ({ page }) => {
  await unlockAdminAndGoToImport(page);
  await page.setInputFiles('#import-file', INVALID_CSV);
  await page.getByRole('button', { name: 'Importer', exact: true }).click();

  // 5 lignes au total, 1 seule valide ("Ligne valide au milieu du lot"), 4 rejetées.
  await expect(page.getByText(/1 question\(s\) importée\(s\) sur 5, 4 rejetée\(s\)/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Lignes rejetées')).toBeVisible();
  await expect(page.getByText('Question en français manquante')).toBeVisible();
  await expect(page.getByText('Durée invalide (doit être un nombre supérieur à zéro).')).toBeVisible();
  await expect(page.getByText('Unité invalide.')).toBeVisible();
  await expect(page.getByText(/Catégorie inconnue/)).toBeVisible();
});

test('création en lot : formulaire de thème + questions, brouillon localStorage récupérable après reload', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.getByRole('button', { name: 'Créer un thème en lot' }).click();
  await expect(page.getByText('Création en lot')).toBeVisible();

  const questionText = `Question bulk e2e ${uniquePseudo('')}`;
  await page.getByLabel('Question (français)').first().fill(questionText);
  await page.getByLabel('Durée réelle').first().fill('25');
  // Déclenche persistDraft() (onblur) : passe le focus ailleurs pour committer le brouillon.
  await page.getByLabel('Question (français)').first().blur();
  await expect(page.getByText('Brouillon sauvegardé')).toBeVisible();

  // Reload : le brouillon doit être proposé (récupérable après crash/refresh, GAME_DESIGN_V2
  // Lot 6). Le routeur maison ne reconnaît que "/" et "/admin" au chargement (pas de
  // deep-link vers /admin-bulk-create, router.svelte.ts::initialRoute) -> un reload sur la
  // sous-route retomberait sur l'accueil. On recharge donc "/admin" explicitement, puis on
  // repasse par Admin -> Bulk create ; le brouillon vit en localStorage, indépendant de la
  // navigation.
  await page.goto('/admin');
  await page.reload();
  await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await page.getByRole('button', { name: 'Créer un thème en lot' }).click();

  await expect(page.getByText('Un brouillon a été trouvé')).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre le brouillon' }).click();
  await expect(page.getByLabel('Question (français)').first()).toHaveValue(questionText);
});
