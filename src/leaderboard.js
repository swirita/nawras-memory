export function normalizePlayerName(value, maxLength = 40) {
  return typeof value === 'string' ? value.normalize('NFC').trim().slice(0, maxLength).trim() : '';
}

export const playerKey = name => normalizePlayerName(name).toLowerCase();
export const compareRecords = (a, b) => a.elapsedMs - b.elapsedMs || a.moves - b.moves;

export function createLeaderboard(config, storage) {
  let records = [];
  let persistent = true;
  const savedRounds = new WeakSet();
  function valid(record) {
    return record && normalizePlayerName(record.name, config.playerNameMaxLength) &&
      Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0 && record.elapsedMs <= config.roundDurationSeconds * 1000 &&
      Number.isInteger(record.moves) && record.moves >= config.pairs.length;
  }
  function merge(values) {
    const best = new Map();
    for (const value of values) {
      if (!valid(value)) continue;
      const record = { name: normalizePlayerName(value.name, config.playerNameMaxLength), elapsedMs: value.elapsedMs, moves: value.moves };
      const key = playerKey(record.name);
      if (!best.has(key) || compareRecords(record, best.get(key)) < 0) best.set(key, record);
    }
    return [...best.values()].sort((a, b) => compareRecords(a, b) || a.name.localeCompare(b.name));
  }
  function read() {
    try {
      const value = JSON.parse(storage.getItem(config.leaderboardStorageKey) || '[]');
      return Array.isArray(value) ? merge(value) : [];
    } catch { return []; }
  }
  records = read();
  function save(round, name) {
    const normalized = normalizePlayerName(name, config.playerNameMaxLength);
    if (round.status !== 'won' || round.pairsFound !== config.pairs.length || !normalized || savedRounds.has(round.cards)) return;
    savedRounds.add(round.cards);
    const candidate = { name: normalized, elapsedMs: round.elapsedMs, moves: round.moves };
    if (!valid(candidate)) return;
    // Merge fresh storage so another tab's records are not discarded.
    records = merge([...records, ...read(), candidate]);
    try { storage.setItem(config.leaderboardStorageKey, JSON.stringify(records)); }
    catch { persistent = false; }
  }
  return { save, top: () => records.slice(0, 5), isPersistent: () => persistent };
}
