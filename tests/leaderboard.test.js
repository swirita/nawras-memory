import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeaderboard, normalizePlayerName } from '../src/leaderboard.js';
import { gameConfig } from '../src/config.js';

test('solo exact ties share competition ranks and retain stable stored order', () => {
  const board = createLeaderboard(gameConfig, storage());
  board.save(round(1234.001, 8), 'Z first');
  board.save(round(1234.002, 8), 'A second');
  board.save(round(1234, 9), 'More moves');
  board.save(round(1250, 6), 'Slower');
  assert.deepEqual(board.rankedTop().map(r => [r.name, r.rank, r.elapsedMs]), [
    ['Z first', 1, 1230], ['A second', 1, 1230], ['More moves', 3, 1230], ['Slower', 4, 1250],
  ]);
});

test('legacy solo records with unknown moves survive without invented tie-breaks', () => {
  const old = [{ name: 'First', elapsedMs: 2000 }, { name: 'Second', elapsedMs: 2000, moves: 10 }, { name: 'Third', elapsedMs: 2000 }];
  const store = storage(JSON.stringify(old));
  const board = createLeaderboard(gameConfig, store);
  assert.deepEqual(board.top(), old);
  board.save(round(3000), 'New');
  assert.deepEqual(board.top().slice(0, 3), old);
  assert.equal('moves' in board.top()[0], false);
  assert.deepEqual(board.rankedTop().map(r => r.rank), [1, 2, 3, 4]);
});

test('multiplayer saves only winners once, ignores time, separates storage, and shares ranks', () => {
  const values = new Map();
  const store = { writes: 0, getItem: key => values.get(key), setItem(key, value) { values.set(key, value); this.writes++; } };
  const solo = createLeaderboard(gameConfig, store);
  const multi = createLeaderboard(gameConfig, store, 'multiplayer');
  const win = (scores, players, elapsedMs = 999999) => ({ ...round(elapsedMs), mode: 'multiplayer', scores, players });
  solo.save(round(2000), 'Solo');
  const first = win([6, 0], ['Z first', 'Loser']);
  multi.save(first); multi.save({ ...first });
  multi.save(win([0, 6], ['Loser', 'A second'], 1));
  multi.save(win([5, 1], ['Five', 'Loser']));
  multi.save(win([4, 2], ['Four', 'Loser']));
  multi.save(win([3, 3], ['Draw A', 'Draw B']));
  multi.save({ ...win([6, 0], ['Abandoned', 'Loser']), status: 'playing' });
  multi.save(win([4, 2], ['z FIRST', 'Loser']));
  assert.deepEqual(multi.rankedTop().map(r => [r.name, r.score, r.rank]), [
    ['Z first', 6, 1], ['A second', 6, 1], ['Five', 5, 3], ['Four', 4, 4],
  ]);
  assert.deepEqual(solo.top().map(r => r.name), ['Solo']);
  assert.equal(store.writes, 6);
  assert.ok(values.has(gameConfig.leaderboardStorageKey));
  assert.ok(values.has(gameConfig.multiplayerLeaderboardStorageKey));
  assert.deepEqual(createLeaderboard(gameConfig, store, 'multiplayer').top(), multi.top());
  assert.ok(multi.top().every(r => !('elapsedMs' in r)));
});

test('multiplayer stores one personal best and shows at most five entries', () => {
  const values = new Map();
  const store = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const board = createLeaderboard(gameConfig, store, 'multiplayer');
  const save = (name, score) => board.save({ ...round(0), mode: 'multiplayer', scores: [score, 6 - score], players: [name, 'Other'] });
  save('Player', 4); save('PLAYER', 5); save('player', 4);
  for (let i = 0; i < 6; i++) save(`Other ${i}`, 4);
  assert.equal(board.top().length, 5);
  assert.deepEqual(board.top()[0], { name: 'PLAYER', score: 5 });
  assert.deepEqual(board.rankedTop().map(r => r.rank), [1, 2, 2, 2, 2]);
});

function storage(initial = '[]') {
  let value = initial;
  return { writes: 0, getItem: () => value, setItem(key, next) { assert.equal(key, gameConfig.leaderboardStorageKey); value = next; this.writes++; } };
}
const round = (elapsedMs, moves = 6) => ({ status: 'won', pairsFound: 6, elapsedMs, moves, cards: [] });

test('all participants remain available with shared ranks beyond the first five', () => {
  const values = new Map();
  const store = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const solo = createLeaderboard(gameConfig, store);
  for (let i = 0; i < 30; i++) solo.save(round(i === 5 ? 1400 : 1000 + i * 100), `Solo ${i}`);
  assert.equal(solo.rankedAll().length, 30);
  assert.deepEqual(solo.rankedAll().slice(0, 7).map(r => r.rank), [1, 2, 3, 4, 5, 5, 7]);
  assert.equal(solo.rankedTop().length, 5);
  assert.equal(createLeaderboard(gameConfig, store).rankedAll().at(-1).name, 'Solo 29');
  const multi = createLeaderboard(gameConfig, store, 'multiplayer');
  for (let i = 0; i < 30; i++) {
    const score = i < 2 ? 6 : i < 6 ? 5 : 4;
    multi.save({ ...round(0), mode: 'multiplayer', scores: [score, 6 - score], players: [`Winner ${i}`, 'Other'] });
  }
  assert.equal(multi.rankedAll().length, 30);
  assert.deepEqual(multi.rankedAll().slice(0, 7).map(r => r.rank), [1, 1, 3, 3, 3, 3, 7]);
  assert.equal(multi.rankedAll().filter(r => r.rank <= 5).length, 6);
  assert.equal(createLeaderboard(gameConfig, store, 'multiplayer').rankedAll().at(-1).name, 'Winner 29');
});

test('clearing a leaderboard persists, isolates modes, and cannot resave an old result', () => {
  const values = new Map();
  const store = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const solo = createLeaderboard(gameConfig, store), multi = createLeaderboard(gameConfig, store, 'multiplayer');
  const completed = round(2000);
  solo.save(completed, 'Test Solo');
  multi.save({ ...round(0), mode: 'multiplayer', scores: [6, 0], players: ['Test Winner', 'Other'] });
  assert.equal(solo.clear(), true);
  assert.deepEqual(solo.top(), []);
  assert.deepEqual(createLeaderboard(gameConfig, store).top(), []);
  assert.equal(multi.top().length, 1);
  solo.save(completed, 'Test Solo');
  assert.deepEqual(solo.top(), []);
  solo.save(round(1000), 'New Player');
  assert.deepEqual(solo.top().map(r => r.name), ['New Player']);
  assert.equal(multi.clear(), true);
  assert.deepEqual(createLeaderboard(gameConfig, store, 'multiplayer').top(), []);
  assert.equal(solo.top().length, 1);
});

test('failed persistent clearing empties the session and does not resurrect old scores', () => {
  const old = JSON.stringify([{ name: 'Old', elapsedMs: 3000, moves: 6 }]);
  const store = { getItem: () => old, setItem() { throw Error('Denied'); }, removeItem() { throw Error('Denied'); } };
  const solo = createLeaderboard(gameConfig, store);
  assert.equal(solo.clear(), false);
  assert.deepEqual(solo.top(), []);
  assert.equal(solo.isPersistent(), false);
  solo.save(round(1000), 'New');
  assert.deepEqual(solo.top().map(r => r.name), ['New']);
});

test('rank uses displayed centisecond precision before moves and displays only five best players', () => {
  const board = createLeaderboard(gameConfig, storage());
  board.save(round(1240, 6), 'Later');
  board.save(round(1230, 20), 'Earlier');
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
  board.save(round(4990, 20), 'Nawras');
  assert.deepEqual(board.top(), [{ name: 'Nawras', elapsedMs: 4990, moves: 20 }]);
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

test('saved entry IDs persist, target retained personal bests, and distinguish duplicate names', () => {
  const store = storage();
  const board = createLeaderboard(gameConfig, store);
  const id = board.save(round(1000), 'Same name');
  assert.ok(id);
  assert.equal(board.save(round(2000), 'SAME NAME'), id);
  assert.equal(board.rankedAll()[0].id, id);
  const duplicateId = 'different-player';
  assert.equal(board.save(round(3000), 'Same name', duplicateId), duplicateId);
  assert.deepEqual(board.rankedAll().map(record => record.id), [id, duplicateId]);
  assert.deepEqual(createLeaderboard(gameConfig, store).rankedAll().map(record => record.id), [id, duplicateId]);
  assert.equal(board.save(round(2500), 'Same name', duplicateId), duplicateId);
  assert.equal(board.rankedAll()[1].elapsedMs, 2500);
});
