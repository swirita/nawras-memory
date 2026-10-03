import './styles.css';
import { assetUrl, gameConfig } from './config.js';
import { createMemoryGame } from './game.js';
import { createGameAudio } from './audio.js';
import { createLandingParticles } from './particles.js';
import { createLeaderboard, normalizePlayerName, playerKey, formatCompletionTime } from './leaderboard.js';
import { createWinCelebration } from './celebration.js';
import { createExpoIdle } from './idle.js';
import { createModeSwitcher } from './mode-switch.js';

// Only attach successfully loaded images to the DOM, avoiding broken-image icons.
// This text fallback is a label, never a replacement logo or fabricated asset.
function showAsset(container, path, label) {
  const fallback = document.createElement('span');
  fallback.className = 'asset-fallback';
  fallback.textContent = label;
  container.append(fallback);

  const image = new Image();
  image.alt = label;
  image.decoding = 'async';
  image.addEventListener('load', () => {
    container.replaceChildren(image);
    container.classList.add('brand-ready');
  }, { once: true });
  image.addEventListener('error', () => {
    container.classList.add('asset-unavailable');
    container.classList.add('brand-ready');
  }, { once: true });
  image.src = assetUrl(path);
}

showAsset(document.querySelector('#landing-brand'), gameConfig.brandImagePath, 'NawrasEdu');

// Keep the landing name across rounds; it is only displayed locally.
export function getPlayerName() {
  return normalizePlayerName(document.querySelector('#player-name').value, gameConfig.playerNameMaxLength);
}

// Landing artwork pauses automatically when its screen is hidden.
export const disposeLandingParticles = createLandingParticles(
  document.querySelector('.landing-particles'),
  document.querySelector('.landing'),
);

const main = document.querySelector('main');
const landing = document.querySelector('.landing');
const screens = document.createElement('div');
screens.className = 'round-screens';
screens.hidden = true;
screens.innerHTML = `
  <section class="game-screen" aria-label="Memory game" hidden>
    <div class="control-bar">
      <dl class="control-stats" aria-label="Round statistics">
        <div id="time-stat"><dt>Time</dt><dd id="time-left">1:00</dd></div>
        <div><dt>Moves</dt><dd id="moves">0</dd></div>
      </dl>
      <div class="player-scores" role="group" aria-label="Players and scores" hidden>
        <div class="player-score" data-player="0"><span class="turn-status">Your turn</span><span class="player-score-name"></span><strong class="player-score-points">0</strong></div>
        <div class="player-score" data-player="1"><span class="turn-status">Your turn</span><span class="player-score-name"></span><strong class="player-score-points">0</strong></div>
      </div>
      <div class="control-actions">
        <button class="secondary-button" id="round-home" type="button">Home</button>
        <button class="secondary-button" id="reset-game" type="button">Reset Game</button>
      </div>
    </div>
    <div class="board-viewport">
      <div class="card-board" role="group" aria-label="Memory cards"></div>
    </div>
    <p id="round-announcement" class="sr-only" role="status" aria-live="polite"></p>
  </section>
  <section class="result-screen" aria-labelledby="result-title" hidden>
    <div class="brand round-brand" id="round-brand"></div>
    <p class="result-player" id="result-player"></p>
    <h2 id="result-title" tabindex="-1">ALL MATCHED!</h2>
    <div class="final-scores" hidden></div>
    <div class="result-primary">
      <span id="result-number"></span>
      <span id="result-unit">SECONDS</span>
    </div>
    <p class="result-moves"><strong id="result-moves">0</strong> MOVES</p>
    <section class="leaderboard" aria-labelledby="leaderboard-title">
      <h3 id="leaderboard-title">TOP 5</h3>
      <ol class="leaderboard-list"></ol>
      <p class="leaderboard-empty">No completed rounds yet.</p>
      <p class="leaderboard-note" hidden>Best rounds are available for this session.</p>
    </section>
    <div class="result-actions">
      <button class="start-button" id="play-again" type="button">PLAY AGAIN</button>
      <button class="secondary-button" id="new-player" type="button">NEW PLAYER</button>
    </div>
  </section>
  <dialog class="reset-dialog" aria-labelledby="reset-title">
    <h2 id="reset-title">Reset game?</h2>
    <div class="dialog-actions">
      <button class="secondary-button" id="cancel-reset" type="button" autofocus>Cancel</button>
      <button class="start-button" id="confirm-reset" type="button">Reset</button>
    </div>
  </dialog>`;
main.append(screens);
const menuLeaderboard = document.createElement('section');
menuLeaderboard.className = 'menu-leaderboard-screen';
menuLeaderboard.hidden = true;
menuLeaderboard.setAttribute('aria-labelledby', 'menu-leaderboard-title');
menuLeaderboard.innerHTML = `
  <h2 id="menu-leaderboard-title" tabindex="-1">Leaderboard</h2>
  <div class="leaderboard-tabs" role="tablist" aria-label="Leaderboard mode">
    <button type="button" id="solo-board-tab" role="tab" aria-selected="true" aria-controls="menu-board-panel" data-leaderboard-mode="solo">Solo</button>
    <button type="button" id="multi-board-tab" role="tab" aria-selected="false" aria-controls="menu-board-panel" data-leaderboard-mode="multiplayer" tabindex="-1">2 Players</button>
  </div>
  <section class="leaderboard" id="menu-board-panel" role="tabpanel" aria-labelledby="solo-board-tab">
    <h3>TOP 5</h3><ol class="leaderboard-list"></ol>
    <p class="leaderboard-empty">No completed rounds yet.</p>
    <p class="leaderboard-note" hidden>Best rounds are available for this session.</p>
  </section>
  <div class="leaderboard-actions">
    <button class="secondary-button" id="leaderboard-back" type="button">Back</button>
    <button class="secondary-button" id="clear-leaderboard" type="button">Clear leaderboard</button>
  </div>
  <p id="leaderboard-clear-status" class="leaderboard-note" role="status" aria-live="polite"></p>`;
main.append(menuLeaderboard);
const clearLeaderboardDialog = document.createElement('dialog');
clearLeaderboardDialog.className = 'clear-leaderboard-dialog';
clearLeaderboardDialog.setAttribute('aria-labelledby', 'clear-leaderboard-title');
clearLeaderboardDialog.setAttribute('aria-describedby', 'clear-leaderboard-description');
clearLeaderboardDialog.innerHTML = `
  <h2 id="clear-leaderboard-title"></h2>
  <p id="clear-leaderboard-description"></p>
  <div class="dialog-actions">
    <button class="secondary-button" id="cancel-clear-leaderboard" type="button" autofocus>Cancel</button>
    <button class="start-button" id="confirm-clear-leaderboard" type="button">Clear</button>
  </div>`;
document.body.append(clearLeaderboardDialog);
const idleDialog = document.createElement('dialog');
idleDialog.className = 'idle-dialog';
idleDialog.setAttribute('aria-labelledby', 'idle-message');
idleDialog.innerHTML = '<h2 id="idle-message" role="status" aria-live="polite"></h2><button class="start-button" type="button">Continue playing</button>';
document.body.append(idleDialog);
showAsset(document.querySelector('#round-brand'), gameConfig.brandImagePath, 'NawrasEdu');
const board = document.querySelector('.card-board');
const gameScreen = document.querySelector('.game-screen');
const resultScreen = document.querySelector('.result-screen');
const startButton = landing.querySelector('.start-button');
const announcement = document.querySelector('#round-announcement');
const resetButton = document.querySelector('#reset-game');
const resetDialog = document.querySelector('.reset-dialog');
const cancelButton = document.querySelector('#cancel-reset');
const confirmButton = document.querySelector('#confirm-reset');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const turnBackdrop = document.createElement('div');
turnBackdrop.className = 'turn-backdrop';
turnBackdrop.setAttribute('aria-hidden', 'true');
turnBackdrop.innerHTML = '<div class="turn-tint turn-tint-cyan"></div><div class="turn-tint turn-tint-lavender"></div>';
main.prepend(turnBackdrop);
const audio = createGameAudio(gameConfig.sound);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const leaderboard = createLeaderboard(gameConfig, storage);
const multiplayerLeaderboard = createLeaderboard(gameConfig, storage, 'multiplayer');
let mode = 'solo';
let players = [];
let lastStartingPlayer;
let currentWinnerName = '';
let menuLeaderboardMode = 'solo';
const activeLeaderboard = () => mode === 'multiplayer' ? multiplayerLeaderboard : leaderboard;
let idleFocus;
const idle = createExpoIdle({
  target: document,
  canShowCountdown: () => landing.hidden,
  onCountdown: seconds => {
    document.querySelector('#idle-message').textContent = `Next player in ${seconds}…`;
    if (!idleDialog.open) {
      idleFocus = document.activeElement;
      idleDialog.showModal();
    }
  },
  onDismiss: () => {
    idleDialog.close();
    if (idleFocus?.isConnected && idleFocus.checkVisibility() && !idleFocus.disabled) idleFocus.focus({ preventScroll: true });
    idleFocus = null;
  },
  onExpire: () => backToStart(),
});
const celebration = createWinCelebration({
  board, screen: gameScreen, durationMs: gameConfig.winCelebrationMs, reducedMotion,
  onSound: audio.play, onResult: showResult,
});
let renderedCards = null;
let previousPairs = 0;
let previousLocked = false;
let playerName = '';
let previousStatus;
let resetDuringCelebration = false;
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const game = createMemoryGame(gameConfig, state => {
  const multiplayer = state.mode === 'multiplayer';
  lastStartingPlayer = state.startingPlayer;
  gameScreen.classList.toggle('multiplayer', multiplayer);
  main.dataset.turn = multiplayer ? String(state.activePlayer) : '';
  document.querySelector('.control-stats').hidden = multiplayer;
  document.querySelector('.player-scores').hidden = !multiplayer;
  if (multiplayer) {
    document.querySelectorAll('.player-score').forEach((panel, index) => {
      panel.querySelector('.player-score-name').textContent = state.players[index];
      panel.querySelector('.player-score-points').textContent = state.scores[index];
      panel.classList.toggle('is-active', index === state.activePlayer);
      panel.querySelector('.turn-status').style.visibility = index === state.activePlayer ? 'visible' : 'hidden';
      panel.setAttribute('aria-label', `${state.players[index]}: ${state.scores[index]} points${index === state.activePlayer ? ', your turn' : ''}`);
    });
  }
  if (renderedCards !== state.cards) {
    renderedCards = state.cards;
    board.replaceChildren(...state.cards.map((card, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'memory-card';
      button.style.setProperty('--entry-delay', `${index * gameConfig.entryDurationMs / 22}ms`);
      button.innerHTML = '<span class="card-motion"><span class="card-inner"><span class="card-face card-back" aria-hidden="true"></span><span class="card-face card-front" aria-hidden="true"></span></span></span>';
      showAsset(button.querySelector('.card-back'), gameConfig.cardBackImagePath, 'NawrasEdu');
      showAsset(button.querySelector('.card-front'), card.imagePath, card.label);
      button.querySelector('.card-front').dataset.image = card.id;
      button.addEventListener('click', () => { audio.unlock(); game.select(index); });
      return button;
    }));
  }
  board.style.setProperty('--entry-duration', `${gameConfig.entryDurationMs / 2}ms`);
  board.classList.toggle('is-entering', state.status === 'entering' || (state.status === 'paused' && state.resumeStatus === 'entering'));
  board.classList.toggle('is-paused', state.status === 'paused');
  state.cards.forEach((card, index) => {
    const button = board.children[index];
    button.classList.toggle('is-revealed', card.revealed);
    button.classList.toggle('is-matched', card.matched);
    button.disabled = card.matched || state.status !== 'playing';
    button.setAttribute('aria-disabled', String(state.locked || card.revealed || button.disabled));
    button.setAttribute('aria-label', `Card ${index + 1}, ${card.matched ? `${card.label}, matched` : card.revealed ? card.label : 'face down'}`);
  });
  document.querySelector('#time-left').textContent = formatTime(state.remainingSeconds);
  document.querySelector('#time-stat').classList.toggle('time-low', state.remainingSeconds <= 10);
  document.querySelector('#moves').textContent = state.moves;
  if (state.pairsFound > previousPairs) announcement.textContent = `Pair found. ${state.pairsFound} of 6 pairs.`;
  else if (state.locked && !previousLocked) announcement.textContent = 'Different cards. Try another pair.';
  else if (previousLocked && !state.locked) announcement.textContent = multiplayer ? `${state.players[state.activePlayer]}'s turn. Choose two cards.` : 'Cards turned back. Choose two cards.';
  else if (!multiplayer && state.remainingSeconds === 10 && announcement.textContent !== '10 seconds remaining.') announcement.textContent = '10 seconds remaining.';
  previousPairs = state.pairsFound;
  previousLocked = state.locked;
  if (previousStatus === 'entering' && state.status === 'playing' && !resetDialog.open) {
    board.children[0].focus({ preventScroll: true });
  }
  previousStatus = state.status;
}, state => {
  if (state.status === 'won') {
    announcement.textContent = 'All matched!';
    // Computed transition durations are seconds, including minified builds.
    const flipDuration = reducedMotion.matches ? 0 : parseFloat(getComputedStyle(board.querySelector('.card-inner')).transitionDuration) * 1000;
    celebration.start(state, flipDuration);
  } else showResult(state);
}, kind => { if (kind !== 'won') audio.play(kind); });

function renderLeaderboard(root = resultScreen.querySelector('.leaderboard'), boardMode = mode) {
  const currentLeaderboard = boardMode === 'multiplayer' ? multiplayerLeaderboard : leaderboard;
  const records = currentLeaderboard.rankedAll();
  const list = root.querySelector('.leaderboard-list');
  list.tabIndex = 0;
  list.setAttribute('aria-label', 'All ranked participants; top 5 ranks highlighted, including ties');
  list.replaceChildren(...records.map(record => {
    const row = document.createElement('li');
    row.className = 'leaderboard-row';
    row.classList.toggle('is-top-five', record.rank <= 5);
    if (root.closest('.result-screen') && playerKey(record.name) === playerKey(boardMode === 'multiplayer' ? currentWinnerName : playerName)) {
      row.classList.add('is-current');
      row.setAttribute('aria-current', 'true');
    }
    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = String(record.rank);
    if (record.rank <= 5) rank.setAttribute('aria-label', `Rank ${record.rank}, top 5`);
    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = record.name;
    name.title = record.name;
    const stats = document.createElement('span');
    stats.className = 'leaderboard-value';
    const time = document.createElement('strong');
    time.textContent = boardMode === 'multiplayer' ? `${record.score} pairs` : `${formatCompletionTime(record.elapsedMs)}s`;
    const moves = document.createElement('small');
    moves.textContent = Number.isInteger(record.moves) ? `${record.moves} moves` : '';
    stats.append(time);
    if (boardMode === 'solo' && Number.isInteger(record.moves)) stats.append(moves);
    row.append(rank, name, stats);
    return row;
  }));
  list.scrollTop = 0;
  list.hidden = records.length === 0;
  root.querySelector('.leaderboard-empty').hidden = records.length > 0;
  root.querySelector('.leaderboard-note').hidden = currentLeaderboard.isPersistent();
  root.querySelector('h3').textContent = boardMode === 'multiplayer' ? '2 PLAYERS · PARTICIPANTS' : 'PARTICIPANTS';
  let summary = root.querySelector('.leaderboard-summary');
  if (!summary) {
    summary = document.createElement('p');
    summary.className = 'leaderboard-summary';
    root.querySelector('h3').after(summary);
  }
  summary.textContent = `${records.length} ${records.length === 1 ? 'participant' : 'participants'} · Top 5 ranks highlighted`;
  summary.hidden = records.length === 0;
}

function showResult(state) {
  activeLeaderboard().save(state, playerName);
  const won = state.status === 'won';
  const multiplayer = state.mode === 'multiplayer';
  celebration.cancel();
  gameScreen.hidden = true;
  resultScreen.hidden = false;
  main.classList.remove('gameplay-active');
  main.dataset.turn = '';
  idle.navigate();
  resultScreen.classList.toggle('is-won', won);
  document.querySelector('#result-player').textContent = playerName;
  document.querySelector('#result-player').hidden = multiplayer;
  document.querySelector('.result-primary').hidden = multiplayer;
  document.querySelector('.result-moves').hidden = multiplayer;
  document.querySelector('.final-scores').hidden = !multiplayer;
  document.querySelector('#play-again').textContent = multiplayer ? 'Rematch' : 'PLAY AGAIN';
  document.querySelector('#new-player').textContent = multiplayer ? 'Home' : 'NEW PLAYER';
  document.querySelector('#result-title').textContent = won ? 'ALL MATCHED!' : 'TIME’S UP!';
  document.querySelector('#result-number').textContent = won ? formatCompletionTime(state.elapsedMs) : `${state.pairsFound} / ${gameConfig.pairs.length}`;
  document.querySelector('#result-unit').textContent = won ? 'SECONDS' : 'PAIRS FOUND';
  document.querySelector('#result-moves').textContent = state.moves;
  currentWinnerName = '';
  if (multiplayer) {
    currentWinnerName = state.winner === null ? '' : state.players[state.winner];
    document.querySelector('#result-title').textContent = state.winner === null ? 'It’s a draw!' : `${currentWinnerName} wins!`;
    document.querySelector('.final-scores').replaceChildren(...state.players.map((name, index) => {
      const row = document.createElement('div');
      row.className = `final-player final-player-${index}`;
      const label = document.createElement('span');
      label.textContent = name;
      const points = document.createElement('strong');
      points.textContent = state.scores[index];
      row.append(label, points);
      return row;
    }));
  }
  renderLeaderboard();
  document.querySelector('#result-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function startRound({ rematch = false, reset = false } = {}) {
  modeSwitcher.finish();
  playerName = getPlayerName();
  if (!playerName) {
    document.querySelector('#player-name-error').hidden = false;
    document.querySelector('#player-name').setAttribute('aria-invalid', 'true');
    document.querySelector('#player-name').focus();
    return;
  }
  document.querySelector('#player-name').value = playerName;
  document.querySelector('#player-name-error').hidden = true;
  document.querySelector('#player-name').removeAttribute('aria-invalid');
  players = [playerName];
  if (mode === 'multiplayer') {
    const input = document.querySelector('#player-two-name');
    const secondName = normalizePlayerName(input.value, gameConfig.playerNameMaxLength);
    if (!secondName) {
      document.querySelector('#player-two-name-error').hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.value = secondName;
    input.removeAttribute('aria-invalid');
    document.querySelector('#player-two-name-error').hidden = true;
    players.push(secondName);
  }
  celebration.cancel();
  resetDuringCelebration = false;
  audio.unlock();
  audio.stop();
  if (resetDialog.open) resetDialog.close();
  landing.hidden = true;
  main.classList.remove('landing-active');
  main.classList.add('round-active');
  main.classList.add('gameplay-active');
  screens.hidden = false;
  gameScreen.hidden = false;
  resultScreen.hidden = true;
  menuLeaderboard.hidden = true;
  previousPairs = 0;
  previousLocked = false;
  announcement.textContent = 'Find six pairs. The round starts when the cards arrive.';
  game.start({ entryDurationMs: reducedMotion.matches ? 0 : gameConfig.entryDurationMs, mode, players,
    turnTransitionMs: reducedMotion.matches ? 0 : gameConfig.matchResolutionMs,
    startingPlayer: mode === 'multiplayer' && (rematch || reset) ? (rematch ? 1 - lastStartingPlayer : lastStartingPlayer) : undefined });
  idle.navigate();
  resetButton.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function backToStart() {
  modeSwitcher.finish();
  celebration.cancel();
  game.stop();
  audio.stop();
  if (resetDialog.open) resetDialog.close();
  if (clearLeaderboardDialog.open) clearLeaderboardDialog.close();
  resetDuringCelebration = false;
  menuLeaderboard.hidden = true;
  gameScreen.hidden = resultScreen.hidden = true;
  board.replaceChildren();
  renderedCards = null;
  players = [];
  playerName = currentWinnerName = '';
  lastStartingPlayer = undefined;
  previousPairs = 0;
  previousLocked = false;
  previousStatus = undefined;
  document.querySelectorAll('#player-name, #player-two-name').forEach(input => { input.value = ''; input.removeAttribute('aria-invalid'); });
  document.querySelectorAll('.name-error').forEach(error => { error.hidden = true; });
  document.querySelector('.setup-form').style.minHeight = '';
  screens.hidden = true;
  landing.hidden = false;
  main.classList.remove('round-active');
  main.classList.remove('gameplay-active');
  main.classList.add('landing-active');
  main.dataset.turn = '';
  idle.navigate();
  startButton.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
startButton.disabled = false;
startButton.removeAttribute('title');
startButton.addEventListener('click', startRound);
document.querySelector('#player-name').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); startRound(); }
});
document.querySelector('#play-again').addEventListener('click', () => startRound({ rematch: mode === 'multiplayer' }));
resetButton.addEventListener('click', () => {
  audio.unlock();
  resetDuringCelebration = celebration.pause();
  if (!resetDuringCelebration && !game.pause()) return;
  audio.stop();
  resetDialog.showModal();
  cancelButton.focus();
});
function cancelReset() {
  resetDialog.close();
  if (resetDuringCelebration) celebration.resume();
  else game.resume();
  resetDuringCelebration = false;
  resetButton.focus({ preventScroll: true });
}
cancelButton.addEventListener('click', cancelReset);
confirmButton.addEventListener('click', () => startRound({ reset: true }));
resetDialog.addEventListener('cancel', event => { event.preventDefault(); cancelReset(); });
resetDialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  if (event.shiftKey && document.activeElement === cancelButton) {
    event.preventDefault(); confirmButton.focus();
  } else if (!event.shiftKey && document.activeElement === confirmButton) {
    event.preventDefault(); cancelButton.focus();
  }
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { game.finishEntrance(); modeSwitcher.finish(); } });
document.querySelector('#player-name').addEventListener('input', () => {
  document.querySelector('#player-name-error').hidden = true;
  document.querySelector('#player-name').removeAttribute('aria-invalid');
});
document.querySelector('#new-player').addEventListener('click', () => {
  backToStart();
  document.querySelector('#player-name').value = '';
  document.querySelector('#player-two-name').value = '';
  document.querySelector('#player-name').focus({ preventScroll: true });
});
document.querySelector('#round-home').addEventListener('click', backToStart);
function applyMode(nextMode) {
  document.querySelectorAll('.name-error').forEach(error => { error.hidden = true; });
  document.querySelectorAll('#player-name, #player-two-name').forEach(input => input.removeAttribute('aria-invalid'));
  document.querySelector('.second-player-entry').hidden = nextMode !== 'multiplayer';
  document.querySelector('#player-two-name').required = nextMode === 'multiplayer';
  document.querySelector('label[for="player-name"]').textContent = nextMode === 'multiplayer' ? 'Player 1 name' : 'Enter your name';
  document.querySelector('#player-name-hint').textContent = nextMode === 'multiplayer' ? 'Take turns finding six pairs on one shared board.' : 'Enter a name for your results and this browser’s leaderboard. Find six pairs in 60 seconds.';
}
const modeSwitcher = createModeSwitcher({ form: document.querySelector('.setup-form'), startButton, reducedMotion, apply: applyMode });
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  celebration.cancel();
  game.stop();
  audio.stop();
  mode = button.dataset.mode;
  lastStartingPlayer = undefined;
  document.querySelectorAll('[data-mode]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
  document.querySelector('.mode-choice').dataset.selectedMode = mode;
  modeSwitcher.switchTo(mode);
}));
document.querySelector('#player-two-name').addEventListener('input', () => {
  document.querySelector('#player-two-name-error').hidden = true;
  document.querySelector('#player-two-name').removeAttribute('aria-invalid');
});
document.querySelector('#player-two-name').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); startRound(); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !gameScreen.hidden) game.refresh();
});
function selectLeaderboardMode(boardMode) {
  menuLeaderboardMode = boardMode;
  document.querySelector('#leaderboard-clear-status').textContent = '';
  document.querySelectorAll('[data-leaderboard-mode]').forEach(tab => {
    const selected = tab.dataset.leaderboardMode === boardMode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) document.querySelector('#menu-board-panel').setAttribute('aria-labelledby', tab.id);
  });
  renderLeaderboard(menuLeaderboard.querySelector('.leaderboard'), boardMode);
  document.querySelector('#clear-leaderboard').disabled = (boardMode === 'multiplayer' ? multiplayerLeaderboard : leaderboard).top().length === 0;
}
document.querySelector('#open-leaderboard').addEventListener('click', () => {
  modeSwitcher.finish();
  celebration.cancel(); game.stop(); audio.stop();
  landing.hidden = true;
  menuLeaderboard.hidden = false;
  main.classList.remove('landing-active');
  main.classList.add('round-active');
  selectLeaderboardMode(mode);
  idle.navigate();
  document.querySelector('#menu-leaderboard-title').focus({ preventScroll: true });
});
document.querySelector('#leaderboard-back').addEventListener('click', backToStart);
document.querySelector('#clear-leaderboard').addEventListener('click', () => {
  const label = menuLeaderboardMode === 'multiplayer' ? '2 Players' : 'Solo';
  document.querySelector('#clear-leaderboard-title').textContent = `Clear ${label} leaderboard?`;
  document.querySelector('#clear-leaderboard-description').textContent = `Remove all saved ${label} scores from this device?`;
  clearLeaderboardDialog.showModal();
});
function cancelLeaderboardClear() {
  clearLeaderboardDialog.close();
  document.querySelector('#clear-leaderboard').focus({ preventScroll: true });
}
document.querySelector('#cancel-clear-leaderboard').addEventListener('click', cancelLeaderboardClear);
clearLeaderboardDialog.addEventListener('cancel', event => { event.preventDefault(); cancelLeaderboardClear(); });
document.querySelector('#confirm-clear-leaderboard').addEventListener('click', () => {
  const current = menuLeaderboardMode === 'multiplayer' ? multiplayerLeaderboard : leaderboard;
  const persisted = current.clear();
  clearLeaderboardDialog.close();
  selectLeaderboardMode(menuLeaderboardMode);
  document.querySelector('#leaderboard-clear-status').textContent = persisted ? 'Leaderboard cleared.' : 'Cleared for this session. Saved scores could not be removed from this device.';
  document.querySelector('#leaderboard-back').focus({ preventScroll: true });
});
document.querySelectorAll('[data-leaderboard-mode]').forEach(tab => {
  tab.addEventListener('click', () => selectLeaderboardMode(tab.dataset.leaderboardMode));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'solo' : event.key === 'End' ? 'multiplayer' : tab.dataset.leaderboardMode === 'solo' ? 'multiplayer' : 'solo';
    selectLeaderboardMode(next);
    document.querySelector(`[data-leaderboard-mode="${next}"]`).focus();
  });
});
idleDialog.addEventListener('cancel', event => { event.preventDefault(); idle.activity(); });
window.addEventListener('pagehide', () => { backToStart(); idle.stop(); });
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
