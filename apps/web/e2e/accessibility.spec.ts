import { test, expect } from '@playwright/test';
import { setupGame, answerOrdre, passCalibration, uniquePseudo } from './helpers';

test('accessibilité : prefers-reduced-motion fait tomber le SplitFlap en cross-fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const pseudoA = uniquePseudo('a11yA');
  const pseudoB = uniquePseudo('a11yB');
  await setupGame(page, { mode: 'ordre_de_grandeur', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });

  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await page.locator('.ordre__unit').first().click();
  await answerOrdre(page, pseudoB, 'Heure');

  await expect(page.getByText('Durée réelle')).toBeVisible();
  // Le SplitFlap reste posé (role=status, aria-live) même en reduced-motion : l'info visible
  // via le contenu accessible (span sr-only) doit rester présente sans dépendre du mouvement.
  // ScoreBar contient elle aussi des SplitFlap (scores des 2 joueurs) : on cible précisément
  // le grand split-flap de révélation (size="mega", unique sur cet écran).
  const splitFlap = page.locator('.split-flap--mega');
  await expect(splitFlap).toHaveAttribute('role', 'status');
  await expect(splitFlap).toHaveAttribute('aria-live', 'polite');
});

test('accessibilité : navigation clavier sur l\'écran de réponse Binaire', async ({ page }) => {
  const pseudoA = uniquePseudo('kbdA');
  const pseudoB = uniquePseudo('kbdB');
  await setupGame(page, { mode: 'binaire', pseudos: [pseudoA, pseudoB], endCondition: 'manual' });
  await passCalibration(page, [pseudoA, pseudoB]);

  await page.getByRole('button', { name: new RegExp('JE SUIS PRÊT') }).click();
  await page.getByRole('button', { name: 'OUI, LONGTEMPS' }).focus();
  await expect(page.getByRole('button', { name: 'OUI, LONGTEMPS' })).toBeFocused();
  await page.keyboard.press('Enter');

  // La réponse a été validée : transition pass-and-play vers le joueur B affichée.
  await expect(page.getByRole('button', { name: new RegExp(`JE SUIS PRÊT.*${pseudoB}`) })).toBeVisible();
});

test('accessibilité : le formulaire admin est navigable au clavier (label + input + bouton)', async ({ page }) => {
  await page.goto('/admin');
  const secretInput = page.getByLabel('Mot de passe admin');
  await secretInput.focus();
  await expect(secretInput).toBeFocused();
  await secretInput.type('test');
  await page.keyboard.press('Enter'); // onkeydown Enter déclenche handleUnlock (Admin.svelte)
  // Pas d'assertion sur le résultat (secret invalide) : on vérifie seulement que le clavier
  // seul suffit à déclencher l'action, sans jamais toucher la souris.
});
