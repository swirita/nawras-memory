export function normalizePlayerName(value, maxLength = 40) {
  return typeof value === 'string' ? value.normalize('NFC').trim().slice(0, maxLength).trim() : '';
}

export const playerKey = name => normalizePlayerName(name).toLowerCase();
// Centiseconds are both the displayed score and the comparison precision.
export const timeUnits = milliseconds => Math.round(milliseconds / 10);
export const formatCompletionTime = milliseconds => (timeUnits(milliseconds) / 100).toFixed(2);
export function compareRecords(a, b) {
  const time = timeUnits(a.elapsedMs) - timeUnits(b.elapsedMs);
  if (time) return time;
  // A missing legacy field is unknown, never zero.
  return Number.isInteger(a.moves) && Number.isInteger(b.moves) ? a.moves - b.moves : 0;
}

export function createLeaderboard(config, storage, mode = 'solo') {
  const multiplayer = mode === 'multiplayer';
  const storageKey = multiplayer ? config.multiplayerLeaderboardStorageKey : config.leaderboardStorageKey;
  const compare = multiplayer ? (a, b) => b.score - a.score : compareRecords;
  let records = [];
  let persistent = true;
  let ignoreStorage = false;
  const savedRounds = new WeakSet();
  // Deterministic IDs migrate legacy personal bests consistently across tabs.
  const legacyId = name => `legacy:${mode}:${encodeURIComponent(playerKey(name))}`;
  function valid(record) {
    if (!record || !normalizePlayerName(record.name, config.playerNameMaxLength)) return false;
    if (multiplayer) return Number.isInteger(record.score) && record.score > config.pairs.length / 2 && record.score <= config.pairs.length;
    return Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0 && record.elapsedMs <= config.roundDurationSeconds * 1000 &&
      (record.moves === undefined || Number.isInteger(record.moves) && record.moves >= config.pairs.length);
  }
  function merge(values) {
    const best = new Map();
    for (const value of values) {
      if (!valid(value)) continue;
      const record = multiplayer
        ? { name: normalizePlayerName(value.name, config.playerNameMaxLength), score: value.score }
        : { name: normalizePlayerName(value.name, config.playerNameMaxLength), elapsedMs: value.elapsedMs,
          ...(value.moves === undefined ? {} : { moves: value.moves }) };
      record.id = typeof value.id === 'string' && value.id ? value.id : legacyId(record.name);
      const key = record.id;
      if (!best.has(key) || compare(record, best.get(key)) < 0) best.set(key, record);
    }
    // Stable sorting preserves stored order without assigning tied players a
    // competitive advantage based on their name or submission time.
    return [...best.values()].sort(compare);
  }
  function read() {
    if (ignoreStorage) return [];
    try {
      const value = JSON.parse(storage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? merge(value) : [];
    } catch { return []; }
  }
  records = read();
  function save(round, name, entryId) {
    if ((round.mode === 'multiplayer') !== multiplayer) return;
    if (round.status !== 'won' || round.pairsFound !== config.pairs.length || savedRounds.has(round.cards)) return;
    let candidate;
    if (multiplayer) {
      if (!Array.isArray(round.scores) || round.scores.length !== 2 || !round.scores.every(n => Number.isInteger(n) && n >= 0) || round.scores[0] + round.scores[1] !== config.pairs.length) return;
      if (round.scores[0] === round.scores[1]) { savedRounds.add(round.cards); return; }
      const winner = round.scores[0] > round.scores[1] ? 0 : 1;
      candidate = { name: normalizePlayerName(round.players?.[winner], config.playerNameMaxLength), score: round.scores[winner] };
    } else {
      if (!Number.isFinite(round.elapsedMs) || round.elapsedMs < 0 || round.elapsedMs > config.roundDurationSeconds * 1000) return;
      const normalized = normalizePlayerName(name, config.playerNameMaxLength);
      candidate = { name: normalized, elapsedMs: timeUnits(round.elapsedMs) * 10, moves: round.moves };
    }
    if (!valid(candidate)) return;
    savedRounds.add(round.cards);
    // Merge fresh storage so another tab's records are not discarded.
    const fresh = merge([...records, ...read()]);
    // Keep the existing one-best-per-name behavior unless a caller supplies a
    // distinct identity. Return the retained best's ID even for a slower round.
    candidate.id = entryId || fresh.find(record => playerKey(record.name) === playerKey(candidate.name))?.id || globalThis.crypto.randomUUID();
    records = merge([...fresh, candidate]);
    try { storage.setItem(storageKey, JSON.stringify(records)); }
    catch { persistent = false; }
    return candidate.id;
  }
  function rankedAll() {
    let rank = 1;
    return records.map((record, index) => {
      const previous = records[index - 1];
      const exactTie = previous && compare(record, previous) === 0 &&
        (multiplayer || Number.isInteger(record.moves) && Number.isInteger(previous.moves));
      if (!exactTie) rank = index + 1;
      return { ...record, rank };
    });
  }
  function clear() {
    records = [];
    try {
      storage.removeItem(storageKey);
      ignoreStorage = false;
      return true;
    } catch {
      persistent = false;
      ignoreStorage = true;
      return false;
    }
  }
  // Preserve the legacy unranked API shape; ranked entries include their IDs.
  return { save, clear, top: () => records.slice(0, 5).map(({ id, ...record }) => record), rankedAll,
    rankedTop: () => rankedAll().slice(0, 5), isPersistent: () => persistent };
}
