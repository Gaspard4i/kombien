import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomCode, buildRoomJoinUrl, generateRoomQr } from '../src/services/room-code.ts';

test('generateRoomCode : 6 caractères, alphabet restreint (sans 0/O/1/I/L)', () => {
  const code = generateRoomCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]+$/);
  assert.doesNotMatch(code, /[01OIL]/);
});

test('generateRoomCode : génère des codes différents (probabiliste, non-déterministe par construction)', () => {
  const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
  assert.ok(codes.size > 1);
});

test('buildRoomJoinUrl : encode le code dans le lien, retire les slashs de fin de base', () => {
  assert.equal(buildRoomJoinUrl('https://kombien.gazai.fr/', 'ABC123'), 'https://kombien.gazai.fr/rooms/join?code=ABC123');
  assert.equal(buildRoomJoinUrl('https://kombien.gazai.fr', 'ABC123'), 'https://kombien.gazai.fr/rooms/join?code=ABC123');
});

test('generateRoomQr : produit un data URL PNG', async () => {
  const qr = await generateRoomQr('https://kombien.gazai.fr/rooms/join?code=ABC123');
  assert.match(qr, /^data:image\/png;base64,/);
});
