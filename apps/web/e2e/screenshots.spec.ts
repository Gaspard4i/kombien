import { test } from '@playwright/test';
import { setupGame, answerOrdre, answerBinaire, uniquePseudo } from './helpers';

// Captures des écrans clés pour le rapport QA (accueil, jeu, révélation, fin), en mobile
// (375px) et desktop (1280px). Ce spec ne fait aucune assertion : il documente l'état visuel.
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test(`captures ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/');
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-01-accueil.png` });

    const pseudoA = uniquePseudo(`shotA${viewport.name}`);
    const pseudoB = uniquePseudo(`shotB${viewport.name}`);
    await setupGame(page, { mode: 'ordre_de_grandeur', pseudoA, pseudoB, endCondition: 'manual' });

    await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-02-en-jeu.png` });

    await page.locator('.ordre__unit').filter({ hasText: 'Heure' }).click();
    await answerOrdre(page, pseudoB, 'Heure');
    await page.waitForTimeout(1600); // laisse le split-flap terminer sa cascade avant capture
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-03-revelation.png` });

    // Écran de fin : on rejoue une partie Binaire courte jusqu'à "Terminer la partie" pour
    // capturer l'écran End avec les stats serveur (flow validé par mode-binaire.spec.ts).
    const pseudoC = uniquePseudo(`shotC${viewport.name}`);
    const pseudoD = uniquePseudo(`shotD${viewport.name}`);
    await setupGame(page, { mode: 'binaire', pseudoA: pseudoC, pseudoB: pseudoD, endCondition: 'manual' });
    for (let i = 0; i < 5; i++) {
      await answerBinaire(page, pseudoC, 'yes');
      await answerBinaire(page, pseudoD, 'no');
      const endGameButton = page.getByRole('button', { name: 'Terminer la partie' });
      if (await endGameButton.isVisible().catch(() => false)) {
        await endGameButton.click();
        break;
      }
      await page.getByRole('button', { name: /Question suivante|Manche suivante/ }).click();
    }
    // Pas de titre "Fin de partie" littéral à l'écran : End.svelte affiche soit le nom du
    // vainqueur soit "Match nul" (voir end.winner / end.draw). "Score final" est un label
    // toujours présent une fois le résultat serveur reçu.
    await page.getByText('Score final').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-04-fin.png`, fullPage: true });
  });
}
