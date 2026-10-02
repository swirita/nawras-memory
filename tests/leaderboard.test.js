import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboard, normalizePlayerName } from '../src/leaderboard.js';
import { gameConfig } from '../src/config.js';

function storage(initial = '[]') {
  let value = initial;
  return { writes: 0, getItem: () => value, setItem(key, next) { assert.equal(key, gameConfig.leaderboardStorageKey); value = next; this.writes++; } };
}
const round = (elapsedMs, moves = 6) => ({ status: 'won', pairsFound: 6, elapsedMs, moves, cards: [] });

test('rank uses full precision before moves and displays only five best players', () => {
  const board = createLeaderboard(gameConfig, storage());
  board.save(round(1234.002, 6), 'Later');
  board.save(round(1234.001, 20), 'Earlier');
  board.save(round(2000, 8), 'Tie slower');
  board.save(round(2000, 7), 'Tie faster');
  board.save(round(3000), 'Fifth');
  board.save(round(4000), 'Sixth');
  assert.deepEqual(board.top().map(r => r.name), ['Earlier', 'Later', 'Tie faster', 'Tie slower', 'Fifth']);
});

test('one personal best per trimmed, normalized name; ties improve by moves', () => {
  const board = createLeaderboard(gameConfig, storage());
  board.save(round(5000, 10), '  Nawras  ');
  board.save(round(6000, 6), 'NAWRAS');
  board.save(round(5000, 9), 'nawras');
  assert.deepEqual(board.top(), [{ name: 'nawras', elapsedMs: 5000, moves: 9 }]);
  board.save(round(4999, 20), 'Nawras');
  assert.deepEqual(board.top(), [{ name: 'Nawras', elapsedMs: 4999, moves: 20 }]);
});

test('save each finished round once; reject empty names and unfinished rounds', () => {
  const store = storage();
  const board = createLeaderboard(gameConfig, store);
  const result = round(1000);
  board.save(result, 'Player'); board.save(result, 'Player');
  assert.equal(store.writes, 1);
  board.save({ ...round(1200), status: 'expired' }, 'Other');
  board.save({ ...round(1200), pairsFound: 5 }, 'Other');
  board.save(round(2000), '   ');
  assert.equal(board.top().length, 1);
  assert.equal(store.writes, 1);
});

test('records persist across instances and merge records from other tabs', () => {
  const store = storage();
  const first = createLeaderboard(gameConfig, store);
  first.save(round(1000), 'First');
  const second = createLeaderboard(gameConfig, store);
  second.save(round(500), 'Second');
  first.save(round(1500), 'Third');
  assert.deepEqual(createLeaderboard(gameConfig, store).top().map(r => r.name), ['Second', 'First', 'Third']);
});

test('malformed storage and unavailable storage do not break rounds', () => {
  const invalid = createLeaderboard(gameConfig, storage('{broken'));
  assert.deepEqual(invalid.top(), []);
  const unavailable = createLeaderboard(gameConfig, { getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); } });
  unavailable.save(round(500), 'Player');
  assert.equal(unavailable.top()[0].name, 'Player');
  assert.equal(unavailable.isPersistent(), false);
  const filtered = createLeaderboard(gameConfig, storage(JSON.stringify([
    { name: '', elapsedMs: 100, moves: 6 }, { name: 'Bad', elapsedMs: -1, moves: 6 },
    { name: 'Bad', elapsedMs: 61000, moves: 6 }, { name: 'Bad', elapsedMs: 100, moves: 1 },
    { name: 'Valid', elapsedMs: 100, moves: 6 }, { name: 'VALID', elapsedMs: 101, moves: 6 },
  ])));
  assert.deepEqual(filtered.top(), [{ name: 'Valid', elapsedMs: 100, moves: 6 }]);
});

test('names are trimmed and length limited without treating text as markup', () => {
  assert.equal(normalizePlayerName('   '), '');
  assert.equal(normalizePlayerName('a'.repeat(100)).length, 40);
  assert.equal(normalizePlayerName('  <script>hi</script>  '), '<script>hi</script>');
});
