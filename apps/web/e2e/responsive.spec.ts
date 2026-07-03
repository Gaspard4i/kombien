import { test, expect, type Page } from '@playwright/test';
import { setupGame, uniquePseudo } from './helpers';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
}

async function assertTouchTargets(page: Page): Promise<void> {
  // Cibles tactiles >= 44px (2.75rem) sur les boutons visibles (DESIGN_SYSTEM.md §5.1/§7).
  const undersized = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons
      .filter((btn) => btn.offsetParent !== null) // visible uniquement
      .filter((btn) => {
        const rect = btn.getBoundingClientRect();
        return rect.height > 0 && rect.height < 44;
      })
      .map((btn) => btn.textContent?.trim().slice(0, 30));
  });
  expect(undersized).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test(`responsive ${viewport.name}px : accueil sans débordement, cibles tactiles correctes`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page);
  });

  test(`responsive ${viewport.name}px : écran de jeu (Ordre de grandeur) sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const pseudoA = uniquePseudo(`resA${viewport.name}`);
    const pseudoB = uniquePseudo(`resB${viewport.name}`);
    await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

    await assertNoHorizontalOverflow(page);

    // Transition -> réponse : la grille d'unités (2/4/7 colonnes selon breakpoint) doit
    // rester sans débordement horizontal et garder des cibles tactiles correctes.
    await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
    await assertNoHorizontalOverflow(page);
    await assertTouchTargets(page);
  });
}
