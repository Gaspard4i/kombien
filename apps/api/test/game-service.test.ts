import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGameResult, type QueryExecutor, type GamePlayerInput } from '../src/services/game-service.ts';

// Vérité terrain en mémoire : question 1 = binaire (seuil catégorie 3600s,
// vraie durée 7200s -> "longtemps"). Question 2 = duel (durée 1000s).
// Question 3 = un piège : le client MENT sur durationSeconds/thresholdSeconds,
// le service doit ignorer ces valeurs et recharger celles de la DB simulée.
// Questions 4/5 : couple de questions différenciées (GAME_DESIGN_V2.md §5),
// une courte et une longue, pour vérifier l'écart relatif de bout en bout.
const QUESTIONS: Record<number, { duration_seconds: number; threshold_seconds: number }> = {
  1: { duration_seconds: 7200, threshold_seconds: 3600 },
  2: { duration_seconds: 1000, threshold_seconds: 500 },
  3: { duration_seconds: 60, threshold_seconds: 3600 }, // vraie durée courte malgré ce que le client prétend
  4: { duration_seconds: 120, threshold_seconds: 3600 },
  5: { duration_seconds: 36000, threshold_seconds: 3600 },
};

function fakeDb(): QueryExecutor {
  return {
    async query(_text: string, values?: unknown[]) {
      const ids = (values?.[0] as number[]) ?? [];
      const rows = ids
        .filter((id) => id in QUESTIONS)
        .map((id) => ({ id, ...QUESTIONS[id]! }));
      return { rows };
    },
  };
}

test('computeGameResult : recharge durationSeconds par questionId, ignore le mensonge client (anti-triche)', async () => {
  // Le joueur A prétend que la question 3 dure 3600s et répond "yes" (longtemps).
  // La vraie durée serveur est 60s (pas longtemps) -> réponse fausse, 0 pt, quel que
  // soit le seuil utilisé (durationSeconds est toujours la vérité terrain serveur).
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        {
          mode: 'binaire',
          questionId: 3,
          roundIndex: 0,
          responseTimeMs: 1000,
          durationSeconds: 3600, // mensonge client
          binaryAnswer: 'yes',
          thresholdSeconds: 3600,
        },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        {
          mode: 'binaire',
          questionId: 3,
          roundIndex: 0,
          responseTimeMs: 1000,
          durationSeconds: 60,
          binaryAnswer: 'no',
          thresholdSeconds: 3600,
        },
      ],
    },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  const bob = result.players.find((p) => p.pseudo === 'Bob')!;

  assert.equal(alice.score, 0); // "yes" est faux vu la vraie durée serveur (60 < 3600)
  assert.equal(bob.score, 1); // "no" est correct
  assert.equal(bob.is_winner, true);
});

test('computeGameResult : thresholdSeconds client respecté (seuil calibré, Lot 4 v2 §3.5, pas une vérité falsifiable)', async () => {
  // Question 3 : vraie durée serveur 60s. Le seuil calibré du joueur (préférence
  // individuelle issue de sa propre calibration) est appliqué tel quel, PAS écrasé
  // par threshold_seconds de la catégorie (3600s pour la question 3, cf. fakeDb) —
  // seule durationSeconds reste une vérité terrain anti-triche.
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        {
          mode: 'binaire',
          questionId: 3,
          roundIndex: 0,
          responseTimeMs: 1000,
          durationSeconds: 60,
          binaryAnswer: 'no',
          thresholdSeconds: 30, // seuil calibré, plus bas que la catégorie -> 60 est "longtemps"
        },
      ],
    },
    { pseudo: 'Bob', answers: [] },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  // Avec le seuil calibré (30s), 60s >= 30 -> "longtemps" -> "no" est FAUX (0 pt).
  // Avec le seuil catégorie (3600s), "no" aurait été correct (1 pt) : le test
  // vérifie bien que c'est le seuil calibré du client qui a été utilisé.
  assert.equal(alice.score, 0);
});

test('computeGameResult : thresholdSeconds absent -> repli sur threshold_seconds de la catégorie (v1)', async () => {
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'binaire', questionId: 3, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 60, binaryAnswer: 'no' },
      ],
    },
    { pseudo: 'Bob', answers: [] },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  // Seuil catégorie (3600s) : 60 < 3600 -> "pas longtemps" -> "no" est correct.
  assert.equal(alice.score, 1);
});

test('computeGameResult : duel recalculé sur la durée serveur, pas la durée client', async () => {
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'duel', questionId: 2, roundIndex: 0, responseTimeMs: 500, durationSeconds: 999999, estValue: 1000, estUnit: 'second', opponentEstValue: 5000, opponentEstUnit: 'second' },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'duel', questionId: 2, roundIndex: 0, responseTimeMs: 500, durationSeconds: 999999, estValue: 5000, estUnit: 'second', opponentEstValue: 1000, opponentEstUnit: 'second' },
      ],
    },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  const bob = result.players.find((p) => p.pseudo === 'Bob')!;

  // Vraie durée serveur = 1000s -> Alice (1000) exacte, gagne le duel.
  assert.equal(alice.score, 2);
  assert.equal(bob.score, 0);
  assert.equal(result.is_draw, false);
});

test('computeGameResult : renvoie les exploits de session par joueur', async () => {
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'yes' },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'no' },
      ],
    },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  assert.ok(alice.session_exploits.includes('speedrunner'));
});

test('computeGameResult : question inconnue -> erreur explicite', async () => {
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'binaire', questionId: 999, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'yes' },
      ],
    },
    { pseudo: 'Bob', answers: [] },
  ];

  await assert.rejects(() => computeGameResult(fakeDb(), players), /questions introuvables/);
});

test('computeGameResult : match nul', async () => {
  const players: GamePlayerInput[] = [
    { pseudo: 'Alice', answers: [] },
    { pseudo: 'Bob', answers: [] },
  ];
  const result = await computeGameResult(fakeDb(), players);
  assert.equal(result.is_draw, true);
  assert.equal(result.players[0]!.is_winner, false);
  assert.equal(result.players[1]!.is_winner, false);
});

test('computeGameResult : duel à 3 joueurs, le service reconstruit les estimations adverses réelles (anti-triche)', async () => {
  // Question 2 : durée serveur 1000s. Alice ment sur l'estimation de Bob dans son payload
  // (opponentEstValue) ; le service doit ignorer ce mensonge et recalculer le classement
  // à partir des estValue RÉELS envoyés par chaque joueur pour cette question.
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        {
          mode: 'duel',
          questionId: 2,
          roundIndex: 0,
          responseTimeMs: 500,
          durationSeconds: 1000,
          estValue: 990,
          estUnit: 'second', // écart 10, devrait être 1er
          opponentEstValue: 999999, // mensonge : prétend que Bob est très loin
          opponentEstUnit: 'second',
        },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'duel', questionId: 2, roundIndex: 0, responseTimeMs: 500, durationSeconds: 1000, estValue: 1200, estUnit: 'second' }, // écart 200, 2e
      ],
    },
    {
      pseudo: 'Carol',
      answers: [
        { mode: 'duel', questionId: 2, roundIndex: 0, responseTimeMs: 500, durationSeconds: 1000, estValue: 5000, estUnit: 'second' }, // écart 4000, 3e
      ],
    },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  const bob = result.players.find((p) => p.pseudo === 'Bob')!;
  const carol = result.players.find((p) => p.pseudo === 'Carol')!;

  assert.equal(alice.score, 2); // seule en tête (rang réel, pas le mensonge) -> floor(2/1)=2
  assert.equal(bob.score, 0); // hors du groupe de tête
  assert.equal(carol.score, 0); // hors du groupe de tête
  assert.equal(alice.is_winner, true);
});

test('computeGameResult : Multi, co-vainqueurs à égalité de tête (pas un match nul général)', async () => {
  const players: GamePlayerInput[] = [
    { pseudo: 'Alice', answers: [{ mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'yes' }] }, // 7200>=3600 -> correct, 1pt
    { pseudo: 'Bob', answers: [{ mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'yes' }] },
    { pseudo: 'Carol', answers: [{ mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, binaryAnswer: 'no' }] }, // faux, 0pt
  ];

  const result = await computeGameResult(fakeDb(), players);
  assert.equal(result.is_draw, false);
  assert.equal(result.players.find((p) => p.pseudo === 'Alice')!.is_winner, true);
  assert.equal(result.players.find((p) => p.pseudo === 'Bob')!.is_winner, true);
  assert.equal(result.players.find((p) => p.pseudo === 'Carol')!.is_winner, false);
});

test('computeGameResult : Duel avec questions différenciées (GAME_DESIGN_V2.md §5.3), classement par écart relatif', async () => {
  // Alice répond à la question 4 (durée 120s, courte), Bob à la question 5 (durée 36000s,
  // longue) — même roundIndex (0), questionId différents. Le service doit les faire
  // s'affronter via roundIndex (pas questionId) et comparer leurs écarts RELATIFS.
  // Alice : |180-120|/120 = 0.5 (50%). Bob : |36060-36000|/36000 ≈ 0.0017 (0.17%) -> Bob
  // gagne largement malgré un écart absolu identique (60s des deux côtés).
  const players: GamePlayerInput[] = [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'duel', questionId: 4, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, estValue: 180, estUnit: 'second' },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'duel', questionId: 5, roundIndex: 0, responseTimeMs: 500, durationSeconds: 0, estValue: 36060, estUnit: 'second' },
      ],
    },
  ];

  const result = await computeGameResult(fakeDb(), players);
  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  const bob = result.players.find((p) => p.pseudo === 'Bob')!;

  assert.equal(alice.score, 0);
  assert.equal(bob.score, 2);
  assert.equal(bob.is_winner, true);
});

test('computeGameResult : fin de partie assouplie (GAME_DESIGN_V2.md §4.2), manche en cours incomplète -> points de la manche annulée ignorés', async () => {
  // Manche 0 complète (les 2 joueurs ont répondu, question 1) : Alice 1 pt, Bob 0 pt.
  // Manche 1 entamée par Alice seule (question 4, "yes" -> correct, 1 pt de plus) : Bob n'a
  // pas encore répondu à cette manche -> elle doit être annulée pour Alice aussi.
  const result = await computeGameResult(fakeDb(), [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'yes' },
        { mode: 'binaire', questionId: 4, roundIndex: 1, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'yes' },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'no' },
      ],
    },
  ]);

  const alice = result.players.find((p) => p.pseudo === 'Alice')!;
  assert.equal(result.cancelled, false);
  assert.equal(alice.score, 1); // seule la manche 0 compte, la réponse de la manche 1 est jetée
});

test('computeGameResult : arrêt pendant la toute première manche incomplète -> partie annulée, aucun résultat', async () => {
  const result = await computeGameResult(fakeDb(), [
    {
      pseudo: 'Alice',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'yes' },
        { mode: 'binaire', questionId: 4, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'yes' },
      ],
    },
    {
      pseudo: 'Bob',
      answers: [
        { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 1000, durationSeconds: 0, binaryAnswer: 'no' },
      ], // Bob n'a répondu qu'à 1 question de la manche 0 -> jamais complète
    },
  ]);

  assert.equal(result.cancelled, true);
  assert.equal(result.players.length, 0);
});
