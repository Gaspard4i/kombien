import { test } from '@playwright/test';
import { setupGame, passCalibration, answerOrdre, answerBinaire, goHome, uniquePseudo } from './helpers';

// Captures des écrans clés v2 pour le rapport QA (accueil, setup enrichi, sélection de
// thèmes, calibration, jeu à 3 joueurs, révélation, classement en cours, fin avec exploits,
// import), en mobile (375px) et desktop (1280px). Ce spec ne fait aucune assertion : il
// documente l'état visuel.
const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1280', width: 1280, height: 800 },
];

const ADMIN_SECRET = process.env.E2E_ADMIN_SECRET ?? '';

for (const viewport of VIEWPORTS) {
  test(`captures ${viewport.name}px`, async ({ page }) => {
    test.setTimeout(60000);
    // "Terminer la partie" déclenche un window.confirm() : sans listener, Playwright le
    // dismiss (annule) par défaut plutôt que de l'accepter.
    page.on('dialog', (dialog) => dialog.accept());
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/');
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-01-accueil.png` });

    // Setup enrichi (N joueurs, sélection de thèmes, condition de fin) : capturé avant de
    // lancer la partie.
    await page.getByRole('button', { name: 'Jouer' }).click();
    await page.getByRole('button', { name: 'Ajouter un joueur' }).click();
    await page.getByLabel('Pseudo joueur 1').fill(`P1${viewport.name}`);
    await page.getByLabel('Pseudo joueur 2').fill(`P2${viewport.name}`);
    await page.getByLabel('Pseudo joueur 3').fill(`P3${viewport.name}`);
    await page.getByRole('button', { name: 'Binaire', exact: false }).first().click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-02-setup.png`, fullPage: true });

    // Sélection de thèmes : mode "Multi-thèmes" (Lot 2 v2).
    await page.getByRole('button', { name: 'Multi-thèmes', exact: false }).click();
    await page.locator('.theme-select__option').first().click();
    await page.locator('.theme-select__option').nth(1).click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-03-selection-themes.png`, fullPage: true });

    await page.getByRole('button', { name: 'On arrête là' }).click();
    await page.getByRole('button', { name: 'Commencer la partie' }).click();

    // Calibration (Lot 4 v2, obligatoire en Binaire). On capture l'intro et la 1ère question
    // manuellement (pas via passCalibration() qui recliquerait "Commencer la calibration",
    // déjà passé ici), puis on termine la phase des 3 joueurs (5 questions chacun).
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-04-calibration-intro.png` });
    await page.getByRole('button', { name: 'Commencer la calibration' }).click();
    await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-05-calibration-question.png` });
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
    }
    for (const pseudo of [`P2${viewport.name}`, `P3${viewport.name}`]) {
      await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
      for (let i = 0; i < 5; i++) {
        await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
      }
    }

    // En jeu à 3 joueurs.
    await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-06-en-jeu-3joueurs.png` });

    // Révélation (dernier joueur répond -> reveal panel).
    await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).click();
    await answerBinaire(page, `P2${viewport.name}`, 'no');
    await answerBinaire(page, `P3${viewport.name}`, 'yes');
    await page.waitForTimeout(1600); // laisse le split-flap terminer sa cascade avant capture
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-07-revelation.png`, fullPage: true });

    // Classement de session en cours (overlay). Le bouton backdrop porte le même label
    // accessible que celui du header -> on scope au dialog pour lever l'ambiguïté.
    await page.getByRole('button', { name: 'Voir le classement' }).click();
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-08-classement-en-cours.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer le classement' }).click();

    // Écran de fin : on rejoue une partie Binaire courte à 2 joueurs jusqu'à "Terminer la
    // partie" pour capturer l'écran End avec les exploits de session (flow validé par
    // mode-binaire.spec.ts).
    const pseudoC = uniquePseudo(`shotC${viewport.name}`);
    const pseudoD = uniquePseudo(`shotD${viewport.name}`);
    await setupGame(page, { mode: 'binaire', pseudos: [pseudoC, pseudoD], endCondition: 'manual' });
    await passCalibration(page, [pseudoC, pseudoD]);
    // v2.1 : une manche = une question -> le header (avec "Terminer la partie") est déjà
    // présent à l'écran de révélation de la 1ère (et unique) manche jouée.
    await answerBinaire(page, pseudoC, 'yes');
    await answerBinaire(page, pseudoD, 'no');
    await page.getByRole('button', { name: 'Terminer la partie' }).click();
    // Pas de titre "Fin de partie" littéral à l'écran : End.svelte affiche soit le nom du
    // vainqueur soit "Match nul" (voir end.winner / end.draw). "Score final" est un label
    // toujours présent une fois le résultat serveur reçu.
    await page.getByText('Score final').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `e2e/screenshots/${viewport.name}-09-fin-exploits.png`, fullPage: true });

    // Import de masse (admin) : uniquement si le secret est fourni (specs admin/import
    // conditionnées de la même façon, cf admin.spec.ts).
    if (ADMIN_SECRET) {
      await goHome(page);
      await page.goto('/admin');
      await page.getByLabel('Mot de passe admin').fill(ADMIN_SECRET);
      await page.getByRole('button', { name: 'Déverrouiller' }).click();
      await page.getByRole('button', { name: 'Importer des questions' }).click();
      await page.screenshot({ path: `e2e/screenshots/${viewport.name}-10-import.png`, fullPage: true });
    }
  });
}
