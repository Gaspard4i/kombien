import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoomState,
  joinRoom,
  reconnectPlayer,
  disconnectPlayer,
  startGame,
  submitAnswer,
  allConnectedPlayersAnswered,
  closeQuestion,
  advanceToNextQuestion,
  computeLeaderboard,
  type RoomState,
  type RoomQuestionRef,
} from '../src/domain/room.ts';
import type { RawAnswer } from '../src/domain/game.ts';

const Q1: RoomQuestionRef = { questionId: 1, roundIndex: 0, durationSeconds: 7200, textFr: 'Q1', textEn: 'Q1' };
const Q2: RoomQuestionRef = { questionId: 2, roundIndex: 1, durationSeconds: 3600, textFr: 'Q2', textEn: 'Q2' };

function binaryAnswer(binaryAnswer: 'yes' | 'no'): RawAnswer {
  return {
    mode: 'binaire',
    questionId: Q1.questionId,
    roundIndex: Q1.roundIndex,
    responseTimeMs: 1000,
    durationSeconds: Q1.durationSeconds,
    binaryAnswer,
    thresholdSeconds: 3600,
  };
}

test('joinRoom : le premier joueur devient maître de jeu, les suivants non', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  const first = joinRoom(state, 'p1', 'Alice');
  state = first.state;
  assert.equal(first.player.isGameMaster, true);

  const second = joinRoom(state, 'p2', 'Bob');
  assert.equal(second.player.isGameMaster, false);
  assert.equal(second.state.players.length, 2);
});

test('reconnectPlayer : renvoie null si le joueur est inconnu de la room', () => {
  const state = createRoomState('ABC123', 'binaire', 10);
  assert.equal(reconnectPlayer(state, 'ghost'), null);
});

test('reconnectPlayer : remet connected=true sans toucher au score ni au rôle', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = disconnectPlayer(state, 'p1');
  assert.equal(state.players[0]!.connected, false);

  const reconnected = reconnectPlayer(state, 'p1')!;
  assert.equal(reconnected.players[0]!.connected, true);
  assert.equal(reconnected.players[0]!.isGameMaster, true);
});

test('reconnectPlayer : ne touche pas aux autres joueurs de la room', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = disconnectPlayer(state, 'p1');
  state = disconnectPlayer(state, 'p2');

  const reconnected = reconnectPlayer(state, 'p1')!;
  assert.equal(reconnected.players.find((p) => p.id === 'p1')!.connected, true);
  // Bob reste déconnecté : reconnecter p1 n'affecte pas les autres joueurs.
  assert.equal(reconnected.players.find((p) => p.id === 'p2')!.connected, false);
});

test('startGame : passe en statut question, questionIndex 0', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);
  assert.equal(state.status, 'question');
  assert.equal(state.questionIndex, 0);
  assert.deepEqual(state.currentQuestion, Q1);
});

test('submitAnswer : refuse hors phase question (not_in_question)', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  const result = submitAnswer(state, 'p1', binaryAnswer('yes'));
  assert.equal(result.error, 'not_in_question');
});

test('submitAnswer : refuse un joueur inconnu de la room', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);
  const result = submitAnswer(state, 'ghost', binaryAnswer('yes'));
  assert.equal(result.error, 'unknown_player');
});

test('submitAnswer : une seule réponse par joueur, la seconde est ignorée (already_answered)', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);

  const first = submitAnswer(state, 'p1', binaryAnswer('yes'));
  assert.equal(first.error, undefined);
  state = first.state;

  const second = submitAnswer(state, 'p1', binaryAnswer('no'));
  assert.equal(second.error, 'already_answered');
  // La réponse enregistrée reste la première (pas d'écrasement).
  assert.equal(second.state.pendingAnswers.get('p1')!.binaryAnswer, 'yes');
});

test('allConnectedPlayersAnswered : false tant que tous les joueurs connectés n\'ont pas répondu', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);

  assert.equal(allConnectedPlayersAnswered(state), false);
  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), false);
  state = submitAnswer(state, 'p2', binaryAnswer('no')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('allConnectedPlayersAnswered : un joueur déconnecté ne bloque jamais la clôture', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);
  state = disconnectPlayer(state, 'p2');

  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('allConnectedPlayersAnswered : false si personne n\'est connecté (pas de clôture prématurée)', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);
  state = disconnectPlayer(state, 'p1');
  assert.equal(allConnectedPlayersAnswered(state), false);
});

test('closeQuestion : complète les non-répondants par noAnswer, applique scorePlayer, cumule les scores', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);
  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state; // seul Alice répond, Bob timeout

  const scorePlayer = (_playerId: string, answer: RawAnswer) => (answer.noAnswer ? 0 : 1);
  const { state: closed, results } = closeQuestion(state, scorePlayer);

  assert.equal(closed.status, 'results');
  const alice = results.find((r) => r.playerId === 'p1')!;
  const bob = results.find((r) => r.playerId === 'p2')!;
  assert.equal(alice.points, 1);
  assert.equal(alice.scoreAfter, 1);
  assert.equal(bob.points, 0);
  assert.equal(bob.answer.noAnswer, true);

  // Les scores cumulés sont reportés sur les joueurs de la room.
  assert.equal(closed.players.find((p) => p.id === 'p1')!.score, 1);
  assert.equal(closed.players.find((p) => p.id === 'p2')!.score, 0);
});

test('advanceToNextQuestion : repart en statut question avec questionIndex incrémenté', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);
  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state;
  state = closeQuestion(state, () => 1).state;

  const next = advanceToNextQuestion(state, Q2);
  assert.equal(next.status, 'question');
  assert.equal(next.questionIndex, 1);
  assert.deepEqual(next.currentQuestion, Q2);
  assert.equal(next.pendingAnswers.size, 0);
});

test('advanceToNextQuestion : null -> fin de partie (statut ended)', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = startGame(state, Q1);
  state = closeQuestion(state, () => 0).state;

  const ended = advanceToNextQuestion(state, null);
  assert.equal(ended.status, 'ended');
  assert.equal(ended.currentQuestion, null);
});

test('computeLeaderboard : trié par score décroissant', () => {
  let state = createRoomState('ABC123', 'binaire', 10);
  state = joinRoom(state, 'p1', 'Alice').state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state.players[0]!.score = 3;
  state.players[1]!.score = 9;

  const leaderboard = computeLeaderboard(state);
  assert.deepEqual(
    leaderboard.map((e) => e.pseudo),
    ['Bob', 'Alice'],
  );
});

test('computeLeaderboard : room vide -> tableau vide', () => {
  const state = createRoomState('ABC123', 'binaire', 10);
  assert.deepEqual(computeLeaderboard(state), []);
});
