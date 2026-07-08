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

const HOST_TOKEN = 'host-secret-token';

const Q1: RoomQuestionRef = { questionId: 1, roundIndex: 0, durationSeconds: 7200, textFr: 'Q1', textEn: 'Q1' };
const Q2: RoomQuestionRef = { questionId: 2, roundIndex: 1, durationSeconds: 3600, textFr: 'Q2', textEn: 'Q2' };

function newRoom(): RoomState {
  return createRoomState('ABC123', 'binaire', 10, HOST_TOKEN);
}

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

test('joinRoom : sans hostToken, un joueur rejoint normalement (jamais hôte, toujours joueur)', () => {
  let state = newRoom();
  const first = joinRoom(state, 'p1', 'Alice');
  state = first.state;
  assert.equal(first.player.isHost, false);
  assert.equal(first.player.isPlaying, true);

  const second = joinRoom(state, 'p2', 'Bob');
  assert.equal(second.player.isHost, false);
  assert.equal(second.state.players.length, 2);
});

test('joinRoom : avec le bon hostToken, le joueur devient hôte (peu importe son ordre d\'arrivée)', () => {
  let state = newRoom();
  // Bob rejoint en premier, sans token : il ne devient jamais hôte, contrairement à
  // l'ancien modèle "premier connecté = MJ".
  state = joinRoom(state, 'p1', 'Bob').state;
  assert.equal(state.players[0]!.isHost, false);

  const host = joinRoom(state, 'p2', 'Alice', { hostToken: HOST_TOKEN });
  assert.equal(host.player.isHost, true);
  assert.equal(host.player.isPlaying, true); // défaut : hôte joueur
});

test('joinRoom : un hostToken incorrect ne fait jamais de ce joueur un hôte', () => {
  const state = newRoom();
  const result = joinRoom(state, 'p1', 'Alice', { hostToken: 'wrong-token' });
  assert.equal(result.player.isHost, false);
});

test('joinRoom : un seul hôte par room, jamais réattribué à un join ultérieur avec le même token', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  const second = joinRoom(state, 'p2', 'Bob', { hostToken: HOST_TOKEN }); // même token, hôte déjà pris
  assert.equal(second.player.isHost, false);
});

test('joinRoom : hôte non-joueur (isPlaying=false), modèle Kahoot "je présente seulement"', () => {
  const state = newRoom();
  const result = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: false });
  assert.equal(result.player.isHost, true);
  assert.equal(result.player.isPlaying, false);
});

test('reconnectPlayer : renvoie null si le joueur est inconnu de la room', () => {
  const state = newRoom();
  assert.equal(reconnectPlayer(state, 'ghost'), null);
});

test('reconnectPlayer : remet connected=true sans toucher au score ni au rôle', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = disconnectPlayer(state, 'p1');
  assert.equal(state.players[0]!.connected, false);

  const reconnected = reconnectPlayer(state, 'p1')!;
  assert.equal(reconnected.players[0]!.connected, true);
  assert.equal(reconnected.players[0]!.isHost, true);
});

test('reconnectPlayer : ne touche pas aux autres joueurs de la room', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = disconnectPlayer(state, 'p1');
  state = disconnectPlayer(state, 'p2');

  const reconnected = reconnectPlayer(state, 'p1')!;
  assert.equal(reconnected.players.find((p) => p.id === 'p1')!.connected, true);
  // Bob reste déconnecté : reconnecter p1 n'affecte pas les autres joueurs.
  assert.equal(reconnected.players.find((p) => p.id === 'p2')!.connected, false);
});

test('startGame : passe en statut question, questionIndex 0', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = startGame(state, Q1);
  assert.equal(state.status, 'question');
  assert.equal(state.questionIndex, 0);
  assert.deepEqual(state.currentQuestion, Q1);
});

test('submitAnswer : refuse hors phase question (not_in_question)', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  const result = submitAnswer(state, 'p1', binaryAnswer('yes'));
  assert.equal(result.error, 'not_in_question');
});

test('submitAnswer : refuse un joueur inconnu de la room', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = startGame(state, Q1);
  const result = submitAnswer(state, 'ghost', binaryAnswer('yes'));
  assert.equal(result.error, 'unknown_player');
});

test('submitAnswer : refuse un hôte non-joueur (not_playing), même si le message answer lui parvenait', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: false }).state;
  state = startGame(state, Q1);
  const result = submitAnswer(state, 'p1', binaryAnswer('yes'));
  assert.equal(result.error, 'not_playing');
});

test('submitAnswer : une seule réponse par joueur, la seconde est ignorée (already_answered)', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
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
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);

  assert.equal(allConnectedPlayersAnswered(state), false);
  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), false);
  state = submitAnswer(state, 'p2', binaryAnswer('no')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('allConnectedPlayersAnswered : un joueur déconnecté ne bloque jamais la clôture', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);
  state = disconnectPlayer(state, 'p2');

  state = submitAnswer(state, 'p1', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('allConnectedPlayersAnswered : false si personne n\'est connecté (pas de clôture prématurée)', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = startGame(state, Q1);
  state = disconnectPlayer(state, 'p1');
  assert.equal(allConnectedPlayersAnswered(state), false);
});

test('allConnectedPlayersAnswered : un hôte non-joueur n\'est jamais attendu (clôture dès que les vrais joueurs ont répondu)', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: false }).state; // hôte, ne joue pas
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);

  // Seul Bob doit répondre : l'hôte non-joueur n'entre jamais dans le calcul.
  state = submitAnswer(state, 'p2', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('allConnectedPlayersAnswered : un hôte JOUEUR compte comme un joueur normal (doit répondre)', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: true }).state; // hôte joueur
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);

  state = submitAnswer(state, 'p2', binaryAnswer('yes')).state;
  assert.equal(allConnectedPlayersAnswered(state), false); // l'hôte-joueur n'a pas répondu

  state = submitAnswer(state, 'p1', binaryAnswer('no')).state;
  assert.equal(allConnectedPlayersAnswered(state), true);
});

test('closeQuestion : complète les non-répondants par noAnswer, applique scorePlayer, cumule les scores', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
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

test('closeQuestion : un hôte non-joueur n\'apparaît jamais dans les résultats de question', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: false }).state; // hôte, ne joue pas
  state = joinRoom(state, 'p2', 'Bob').state;
  state = startGame(state, Q1);
  state = submitAnswer(state, 'p2', binaryAnswer('yes')).state;

  const { state: closed, results } = closeQuestion(state, () => 1);

  assert.equal(results.some((r) => r.playerId === 'p1'), false);
  assert.equal(results.find((r) => r.playerId === 'p2')!.points, 1);
  // Le score de l'hôte non-joueur reste à 0, jamais mis à jour.
  assert.equal(closed.players.find((p) => p.id === 'p1')!.score, 0);
});

test('advanceToNextQuestion : repart en statut question avec questionIndex incrémenté', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
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
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
  state = startGame(state, Q1);
  state = closeQuestion(state, () => 0).state;

  const ended = advanceToNextQuestion(state, null);
  assert.equal(ended.status, 'ended');
  assert.equal(ended.currentQuestion, null);
});

test('computeLeaderboard : trié par score décroissant', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN }).state;
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
  const state = newRoom();
  assert.deepEqual(computeLeaderboard(state), []);
});

test('computeLeaderboard : un hôte non-joueur n\'apparaît jamais dans le classement', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: false }).state; // hôte, ne joue pas
  state = joinRoom(state, 'p2', 'Bob').state;
  state.players[1]!.score = 5;

  const leaderboard = computeLeaderboard(state);
  assert.deepEqual(
    leaderboard.map((e) => e.pseudo),
    ['Bob'],
  );
});

test('computeLeaderboard : un hôte JOUEUR apparaît dans le classement comme n\'importe quel joueur', () => {
  let state = newRoom();
  state = joinRoom(state, 'p1', 'Alice', { hostToken: HOST_TOKEN, isPlaying: true }).state; // hôte joueur
  state = joinRoom(state, 'p2', 'Bob').state;
  state.players[0]!.score = 10;
  state.players[1]!.score = 5;

  const leaderboard = computeLeaderboard(state);
  assert.deepEqual(
    leaderboard.map((e) => e.pseudo),
    ['Alice', 'Bob'],
  );
});
