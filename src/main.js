import './styles.css';
import { assetUrl, gameConfig } from './config.js';
import { GAMEPLAY_STATUS } from './game.js';
import { createLandingParticles } from './particles.js';

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

document.querySelector('main').dataset.gameplayStatus = GAMEPLAY_STATUS;
showAsset(document.querySelector('#landing-brand'), gameConfig.cardBackImagePath, 'NawrasEdu');

// Keep the entered name available for the timed round when gameplay is added.
export function getPlayerName() {
  return document.querySelector('#player-name').value.trim();
}

// Future screen transitions can call this cleanup before mounting gameplay.
export const disposeLandingParticles = createLandingParticles(
  document.querySelector('.landing-particles'),
  document.querySelector('.landing'),
);
