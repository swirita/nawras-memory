import './styles.css';
import { assetUrl, gameConfig } from './config.js';
import { createMemoryGame } from './game.js';
import { createGameAudio } from './audio.js';
import { createLandingParticles } from './particles.js';
import { createLeaderboard, normalizePlayerName, playerKey } from './leaderboard.js';
import { createWinCelebration } from './celebration.js';

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

showAsset(document.querySelector('#landing-brand'), gameConfig.cardBackImagePath, 'NawrasEdu');

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
      <button class="secondary-button" id="reset-game" type="button">Reset Game</button>
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
showAsset(document.querySelector('#round-brand'), gameConfig.cardBackImagePath, 'NawrasEdu');
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
const audio = createGameAudio(gameConfig.sound);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const leaderboard = createLeaderboard(gameConfig, storage);
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
  else if (previousLocked && !state.locked) announcement.textContent = 'Cards turned back. Choose two cards.';
  else if (state.remainingSeconds === 10 && announcement.textContent !== '10 seconds remaining.') announcement.textContent = '10 seconds remaining.';
  previousPairs = state.pairsFound;
  previousLocked = state.locked;
  if (previousStatus === 'entering' && state.status === 'playing' && !resetDialog.open) {
    board.children[0].focus({ preventScroll: true });
  }
  previousStatus = state.status;
}, state => {
  leaderboard.save(state, playerName);
  if (state.status === 'won') {
    announcement.textContent = 'All matched!';
    // Computed transition durations are seconds, including minified builds.
    const flipDuration = reducedMotion.matches ? 0 : parseFloat(getComputedStyle(board.querySelector('.card-inner')).transitionDuration) * 1000;
    celebration.start(state, flipDuration);
  } else showResult(state);
}, kind => { if (kind !== 'won') audio.play(kind); });

function renderLeaderboard() {
  const records = leaderboard.top();
  document.querySelector('.leaderboard-list').replaceChildren(...records.map((record, index) => {
    const row = document.createElement('li');
    row.className = 'leaderboard-row';
    if (playerKey(record.name) === playerKey(playerName)) {
      row.classList.add('is-current');
      row.setAttribute('aria-current', 'true');
    }
    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = String(index + 1);
    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = record.name;
    name.title = record.name;
    const stats = document.createElement('span');
    stats.className = 'leaderboard-value';
    const time = document.createElement('strong');
    time.textContent = `${(record.elapsedMs / 1000).toFixed(2)}s`;
    const moves = document.createElement('small');
    moves.textContent = `${record.moves} moves`;
    stats.append(time, moves);
    row.append(rank, name, stats);
    return row;
  }));
  document.querySelector('.leaderboard-empty').hidden = records.length > 0;
  document.querySelector('.leaderboard-note').hidden = leaderboard.isPersistent();
}

function showResult(state) {
  const won = state.status === 'won';
  celebration.cancel();
  gameScreen.hidden = true;
  resultScreen.hidden = false;
  main.classList.remove('gameplay-active');
  resultScreen.classList.toggle('is-won', won);
  document.querySelector('#result-player').textContent = playerName;
  document.querySelector('#result-title').textContent = won ? 'ALL MATCHED!' : 'TIME’S UP!';
  document.querySelector('#result-number').textContent = won ? state.elapsedSeconds.toFixed(2) : `${state.pairsFound} / ${gameConfig.pairs.length}`;
  document.querySelector('#result-unit').textContent = won ? 'SECONDS' : 'PAIRS FOUND';
  document.querySelector('#result-moves').textContent = state.moves;
  renderLeaderboard();
  document.querySelector('#result-title').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function startRound() {
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
  previousPairs = 0;
  previousLocked = false;
  announcement.textContent = 'Find six pairs. The round starts when the cards arrive.';
  game.start({ entryDurationMs: reducedMotion.matches ? 0 : gameConfig.entryDurationMs });
  resetButton.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function backToStart() {
  celebration.cancel();
  game.stop();
  audio.stop();
  if (resetDialog.open) resetDialog.close();
  screens.hidden = true;
  landing.hidden = false;
  main.classList.remove('round-active');
  main.classList.remove('gameplay-active');
  startButton.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
startButton.disabled = false;
startButton.removeAttribute('title');
startButton.addEventListener('click', startRound);
document.querySelector('#player-name').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); startRound(); }
});
document.querySelector('#play-again').addEventListener('click', startRound);
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
confirmButton.addEventListener('click', startRound);
resetDialog.addEventListener('cancel', event => { event.preventDefault(); cancelReset(); });
resetDialog.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  if (event.shiftKey && document.activeElement === cancelButton) {
    event.preventDefault(); confirmButton.focus();
  } else if (!event.shiftKey && document.activeElement === confirmButton) {
    event.preventDefault(); cancelButton.focus();
  }
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) game.finishEntrance(); });
document.querySelector('#player-name').addEventListener('input', () => {
  document.querySelector('#player-name-error').hidden = true;
  document.querySelector('#player-name').removeAttribute('aria-invalid');
});
document.querySelector('#new-player').addEventListener('click', () => {
  backToStart();
  document.querySelector('#player-name').value = '';
  document.querySelector('#player-name').focus({ preventScroll: true });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !gameScreen.hidden) game.refresh();
});
window.addEventListener('pagehide', backToStart);
