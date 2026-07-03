import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePlayerRun,
  decideWinners,
  type RawAnswer,
} from '../src/domain/game.ts';

test('computePlayerRun : binaire, streak et multiplicateur cumulés', () => {
  // 5 bonnes réponses binaires d'affilée : 1,1,2,2,3 = 9 pts. bestStreak 5.
  const answers: RawAnswer[] = Array.from({ length: 5 }, (_, i) => ({
    mode: 'binaire',
    questionId: i + 1,
    roundIndex: 0,
    responseTimeMs: 4000,
    durationSeconds: 7200,
    binaryAnswer: 'yes',
    thresholdSeconds: 3600,
  }));
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 9);
  assert.equal(c.goodAnswers, 5);
  assert.equal(c.totalAnswers, 5);
  assert.equal(c.bestStreak, 5);
  assert.equal(c.accuracy, 1);
});

test('computePlayerRun : mauvaise réponse reset le streak', () => {
  const answers: RawAnswer[] = [
    { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
    { mode: 'binaire', questionId: 2, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 1800, binaryAnswer: 'yes', thresholdSeconds: 3600 }, // faux
    { mode: 'binaire', questionId: 3, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 7200, binaryAnswer: 'yes', thresholdSeconds: 3600 },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.goodAnswers, 2);
  assert.equal(c.bestStreak, 1);
  assert.equal(c.finalScore, 2); // 1 + 0 + 1
});

test('computePlayerRun : ordre de grandeur exact', () => {
  const answers: RawAnswer[] = [
    { mode: 'ordre_de_grandeur', questionId: 1, roundIndex: 0, responseTimeMs: 2000, durationSeconds: 259200, chosenUnit: 'day' },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 3);
  assert.equal(c.playedAnswers[0]!.exactMagnitude, true);
});

test('computePlayerRun : duel gagné compte duelsWon', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
      roundIndex: 0,
      responseTimeMs: 2000,
      durationSeconds: 3600,
      estValue: 1,
      estUnit: 'hour',
      opponentEstValue: 3,
      opponentEstUnit: 'hour',
    },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 2);
  assert.equal(c.duelsWon, 1);
  assert.equal(c.playedAnswers[0]!.wonDuel, true);
  assert.equal(c.playedAnswers[0]!.duelErrorSeconds, 0);
});

test('computePlayerRun : duel perdu, aucun point', () => {
  const answers: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
      roundIndex: 0,
      responseTimeMs: 2000,
      durationSeconds: 3600,
      estValue: 10,
      estUnit: 'hour',
      opponentEstValue: 1,
      opponentEstUnit: 'hour',
    },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 0);
  assert.equal(c.duelsWon, 0);
});

test('computePlayerRun : partie sans réponse -> accuracy 0', () => {
  const c = computePlayerRun({ answers: [] });
  assert.equal(c.accuracy, 0);
  assert.equal(c.totalAnswers, 0);
  assert.equal(c.finalScore, 0);
});

test('computePlayerRun : duel sans aucun adversaire renseigné -> seul en tête par défaut (2 pts, cas défensif)', () => {
  // Ne devrait pas se produire en pratique (Duel implique >= 2 joueurs), mais
  // resolveOpponentEstimates doit rester robuste à une liste d'adversaires vide.
  const answers: RawAnswer[] = [
    { mode: 'duel', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 3600, estValue: 1, estUnit: 'hour' },
  ];
  const c = computePlayerRun({ answers });
  assert.equal(c.finalScore, 2);
});

test('decideWinners : Duo, A, B ou match nul (comportement v1 inchangé)', () => {
  assert.deepEqual(decideWinners([10, 5]), { winnerIndices: [0], isDraw: false });
  assert.deepEqual(decideWinners([5, 10]), { winnerIndices: [1], isDraw: false });
  assert.deepEqual(decideWinners([7, 7]), { winnerIndices: [0, 1], isDraw: true });
});

test('decideWinners : Multi, vainqueur unique parmi N joueurs', () => {
  const r = decideWinners([10, 30, 5, 20]);
  assert.deepEqual(r, { winnerIndices: [1], isDraw: false });
});

test('decideWinners : Multi, co-vainqueurs à égalité de tête (pas un match nul général)', () => {
  // Alice et Bob à égalité en tête (30), Carol en dessous (10) : co-vainqueurs, pas de nul.
  const r = decideWinners([30, 30, 10]);
  assert.deepEqual(r, { winnerIndices: [0, 1], isDraw: false });
});

test('decideWinners : Multi, match nul général si TOUS les joueurs sont à égalité', () => {
  const r = decideWinners([15, 15, 15]);
  assert.deepEqual(r, { winnerIndices: [0, 1, 2], isDraw: true });
});

test('computePlayerRun : duel à 3 joueurs, seule la tête marque (GAME_DESIGN_V2 §1.3, floor(2/k))', () => {
  // Durée réelle 3600s. Alice écart 100 (seule en tête, k=1 -> floor(2/1)=2 pts),
  // Bob écart 500 et Carol écart 900 : hors du groupe de tête -> 0 pt chacun.
  const alice: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
      roundIndex: 0,
      responseTimeMs: 1000,
      durationSeconds: 3600,
      estValue: 3500,
      estUnit: 'second',
      opponentEstimates: [
        { value: 3100, unit: 'second' }, // Bob, écart 500
        { value: 2700, unit: 'second' }, // Carol, écart 900
      ],
    },
  ];
  const c = computePlayerRun({ answers: alice });
  assert.equal(c.finalScore, 2);
  assert.equal(c.duelsWon, 1);
  assert.equal(c.playedAnswers[0]!.wonDuel, true);
});

test('computePlayerRun : duel à 3 joueurs, 2 ex-æquo au sommet -> floor(2/2)=1 chacun (GAME_DESIGN_V2 §1.3)', () => {
  // Alice et Bob à égalité au sommet (écart 100 chacun, k=2 -> floor(2/2)=1), Carol loin
  // derrière (écart 900, hors du groupe de tête -> 0 pt).
  const alice: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
      roundIndex: 0,
      responseTimeMs: 1000,
      durationSeconds: 3600,
      estValue: 3500,
      estUnit: 'second',
      opponentEstimates: [
        { value: 3700, unit: 'second' }, // Bob, écart 100 (égalité avec Alice)
        { value: 2700, unit: 'second' }, // Carol, écart 900
      ],
    },
  ];
  const c = computePlayerRun({ answers: alice });
  assert.equal(c.finalScore, 1);
  assert.equal(c.duelsWon, 0); // 1 pt seulement, pas un duel "gagné" (2 pts)
});

test('computePlayerRun : duel avec questions différenciées, écart relatif via opponentEstimates.durationSeconds', () => {
  // Alice : durée 120s, estime 180s -> écart relatif 0.5. Adversaire (Bob, question
  // différente) : durée 36000s, estime 36060s -> écart relatif ~0.0017. Bob gagne malgré un
  // écart absolu identique (60s) : ce test isole le comportement au niveau domaine, sans
  // passer par le service (couvert par game-service.test.ts en bout en bout).
  const alice: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 4,
      roundIndex: 0,
      responseTimeMs: 1000,
      durationSeconds: 120,
      estValue: 180,
      estUnit: 'second',
      opponentEstimates: [{ value: 36060, unit: 'second', durationSeconds: 36000 }],
    },
  ];
  const c = computePlayerRun({ answers: alice });
  assert.equal(c.finalScore, 0);
  assert.equal(c.duelsWon, 0);
});

test('computePlayerRun : duel, 3 joueurs tous ex-æquo -> floor(2/3)=0, personne ne marque', () => {
  // Tous à écart identique 100 : k=3 -> floor(2/3)=0. Personne ne se détache, personne ne
  // marque ni ne maintient son streak (GAME_DESIGN_V2 §1.3, note team-lead).
  const alice: RawAnswer[] = [
    {
      mode: 'duel',
      questionId: 1,
      roundIndex: 0,
      responseTimeMs: 1000,
      durationSeconds: 3600,
      estValue: 3500,
      estUnit: 'second',
      opponentEstimates: [
        { value: 3700, unit: 'second' },
        { value: 3700, unit: 'second' },
      ],
    },
  ];
  const c = computePlayerRun({ answers: alice });
  assert.equal(c.finalScore, 0);
  assert.equal(c.goodAnswers, 0);
  assert.equal(c.playedAnswers[0]!.goodAnswer, false);
});
