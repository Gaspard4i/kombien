import { defineConfig, devices } from '@playwright/test';

// Cible la stack prod déjà montée (infra/docker-compose.yml, front nginx sur le loopback
// 8013 qui proxy /api -> api:3000). Pas de webServer ici : la stack est démarrée séparément
// (voir docs QA), notamment parce que le port 5173 (dev Vite) peut déjà être occupé en local.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8013',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    // Locale fr-FR : le jeu détecte la langue navigateur au premier chargement (fr par
    // défaut sinon), on fixe donc l'environnement de test pour matcher ce défaut produit.
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
