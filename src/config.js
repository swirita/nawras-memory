// Public asset paths stay relative: never prefix them with a site-root slash.
export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export const gameConfig = Object.freeze({
  roundDurationSeconds: 60,
  mismatchRevealDelayMs: 900,
  entryDurationMs: 660,
  winCelebrationMs: 1800,
  playerNameMaxLength: 40,
  leaderboardStorageKey: 'nawras-memory.leaderboard.v1',
  sound: Object.freeze({ enabled: true, volume: 0.16 }),
  brandImagePath: 'assets/branding/nawras-name.png',
  cardBackImagePath: 'assets/branding/light-nawras.png',
  pairs: Object.freeze([
    { id: 'nawras', label: 'NawrasEdu', imagePath: 'assets/branding/nawras-small.png' },
    { id: 'python', label: 'Python', imagePath: 'assets/cards/python.png' },
    { id: 'robot', label: 'Robot', imagePath: 'assets/cards/robot.png' },
    { id: 'laptop', label: 'Laptop', imagePath: 'assets/cards/laptop.png' },
    { id: 'controller', label: 'Controller', imagePath: 'assets/cards/controller.png' },
    { id: 'lightbulb', label: 'Lightbulb', imagePath: 'assets/cards/lightbulb.png' },
  ].map(Object.freeze)),
});
