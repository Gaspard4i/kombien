import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRoomAnswer, withRoomLock, type StreakByPlayer } from '../src/services/room-service.ts';
import type { RawAnswer } from '../src/domain/game.ts';
import type { DuelEstimate } from '../src/domain/scoring.ts';

// scoreRoomAnswer est le point d'intégration entre le domaine pur déjà 100% testé
// (scoring.ts, streak.ts) et l'orchestration temps réel (streak PAR JOUEUR tenu en mémoire
// de room, question par question plutôt que rejoué en fin de partie comme en pass-and-play).
// Ces tests vérifient que le streak persiste correctement à travers plusieurs appels
// successifs, pas la formule de scoring elle-même (déjà couverte ailleurs).

function binaryAnswer(binaryAnswer: 'yes' | 'no', durationSeconds = 7200, thresholdSeconds = 3600): RawAnswer {
  return { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds, binaryAnswer, thresholdSeconds };
}

test('scoreRoomAnswer : binaire, streak persiste et applique le multiplicateur question après question', () => {
  const streaks: StreakByPlayer = new Map();

  // 3 bonnes réponses d'affilée : 1, 1, 2 (palier x2 atteint au streak 3).
  const p1 = scoreRoomAnswer(streaks, 'alice', binaryAnswer('yes'), []);
  const p2 = scoreRoomAnswer(streaks, 'alice', binaryAnswer('yes'), []);
  const p3 = scoreRoomAnswer(streaks, 'alice', binaryAnswer('yes'), []);

  assert.equal(p1, 1);
  assert.equal(p2, 1);
  assert.equal(p3, 2);
  assert.equal(streaks.get('alice'), 3);
});

test('scoreRoomAnswer : mauvaise réponse reset le streak du joueur', () => {
  const streaks: StreakByPlayer = new Map([['alice', 4]]);
  const points = scoreRoomAnswer(streaks, 'alice', binaryAnswer('no', 7200, 3600), []); // 7200>=3600 -> "no" faux
  assert.equal(points, 0);
  assert.equal(streaks.get('alice'), 0);
});

test('scoreRoomAnswer : ordre de grandeur, exact = 3 pts', () => {
  const streaks: StreakByPlayer = new Map();
  const answer: RawAnswer = { mode: 'ordre_de_grandeur', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds: 259200, chosenUnit: 'day' };
  const points = scoreRoomAnswer(streaks, 'bob', answer, []);
  assert.equal(points, 3);
});

test('scoreRoomAnswer : streaks indépendants par joueur (un joueur ne casse pas le streak d un autre)', () => {
  const streaks: StreakByPlayer = new Map();
  scoreRoomAnswer(streaks, 'alice', binaryAnswer('yes'), []);
  scoreRoomAnswer(streaks, 'bob', binaryAnswer('no', 7200, 3600), []); // faux pour Bob
  assert.equal(streaks.get('alice'), 1);
  assert.equal(streaks.get('bob'), 0);
});

test('scoreRoomAnswer : duel à N joueurs, opponents fournis déterminent le groupe de tête', () => {
  const streaks: StreakByPlayer = new Map();
  const self: RawAnswer = { mode: 'duel', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds: 1000, estValue: 990, estUnit: 'second' };
  const opponents: DuelEstimate[] = [
    { value: 1200, unit: 'second', durationSeconds: 1000 }, // écart 200, hors tête
    { value: 5000, unit: 'second', durationSeconds: 1000 }, // écart 4000, hors tête
  ];
  const points = scoreRoomAnswer(streaks, 'alice', self, opponents);
  assert.equal(points, 2); // seule en tête (écart 10) -> floor(2/1)
});

test('scoreRoomAnswer : binaire, noAnswer -> toujours 0 pt (même si "no" aurait été la bonne réponse)', () => {
  const streaks: StreakByPlayer = new Map();
  // Piège : durationSeconds (1000) < thresholdSeconds (3600) -> "no" aurait été correct.
  // binaryAnswer est absent (non-réponse) : scoreBinary(undefined, ...) interpréterait cela
  // comme "no" et marquerait à tort -> ce test garantit que noAnswer court-circuite à 0.
  const answer: RawAnswer = { mode: 'binaire', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds: 1000, thresholdSeconds: 3600, noAnswer: true };
  const points = scoreRoomAnswer(streaks, 'alice', answer, []);
  assert.equal(points, 0);
  assert.equal(streaks.get('alice'), 0);
});

test('scoreRoomAnswer : ordre de grandeur, noAnswer -> toujours 0 pt', () => {
  const streaks: StreakByPlayer = new Map();
  const answer: RawAnswer = { mode: 'ordre_de_grandeur', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds: 259200, noAnswer: true };
  const points = scoreRoomAnswer(streaks, 'alice', answer, []);
  assert.equal(points, 0);
});

test('scoreRoomAnswer : duel, noAnswer -> écart infini, jamais dans le groupe de tête', () => {
  const streaks: StreakByPlayer = new Map();
  const self: RawAnswer = { mode: 'duel', questionId: 1, roundIndex: 0, responseTimeMs: 0, durationSeconds: 1000, estValue: 1000, estUnit: 'second', noAnswer: true };
  const points = scoreRoomAnswer(streaks, 'alice', self, []);
  assert.equal(points, 0);
});

// Régression : deux `join` concurrents sur la même room (deux joueurs qui rejoignent au même
// instant) doivent être sérialisés, sinon les deux peuvent lire "players.length === 0" avant
// que l'un ou l'autre ait sauvegardé et devenir maître de jeu tous les deux (§6.1, bug observé
// en test manuel bout en bout avant l'introduction de withRoomLock).
test('withRoomLock : sérialise les opérations concurrentes sur une même room', async () => {
  const order: number[] = [];
  let counter = 0;

  // Simule un load -> lecture d'un compteur partagé -> incrémentation -> save, avec un yield
  // d'event loop entre lecture et écriture (comme un vrai aller-retour Redis) : sans verrou,
  // deux opérations concurrentes liraient la même valeur de `counter` avant que l'une des deux
  // n'écrive, produisant une incrémentation perdue.
  async function readModifyWrite(code: string, id: number): Promise<void> {
    await withRoomLock(code, async () => {
      const read = counter;
      await new Promise((resolve) => setImmediate(resolve)); // yield, comme un await Redis réel
      counter = read + 1;
      order.push(id);
    });
  }

  await Promise.all([readModifyWrite('ROOM1', 1), readModifyWrite('ROOM1', 2), readModifyWrite('ROOM1', 3)]);

  assert.equal(counter, 3); // aucune incrémentation perdue
  assert.deepEqual(order, [1, 2, 3]); // exécutées dans l'ordre d'arrivée, jamais en parallèle
});

test('withRoomLock : des rooms différentes ne se bloquent pas entre elles', async () => {
  const results: string[] = [];
  await Promise.all([
    withRoomLock('ROOM_A', async () => {
      results.push('A');
    }),
    withRoomLock('ROOM_B', async () => {
      results.push('B');
    }),
  ]);
  assert.deepEqual(new Set(results), new Set(['A', 'B']));
});

test('withRoomLock : une opération qui échoue ne bloque pas les suivantes sur la même room', async () => {
  const calls: string[] = [];
  await assert.rejects(
    withRoomLock('ROOM2', async () => {
      calls.push('first');
      throw new Error('boom');
    }),
  );
  await withRoomLock('ROOM2', async () => {
    calls.push('second');
  });
  assert.deepEqual(calls, ['first', 'second']);
});
