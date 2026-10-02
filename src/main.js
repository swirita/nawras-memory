import './styles.css';
import { assetUrl, gameConfig } from './config.js';
import { GAMEPLAY_STATUS } from './game.js';

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
  image.addEventListener('load', () => container.replaceChildren(image), { once: true });
  image.addEventListener('error', () => {
    container.classList.add('asset-unavailable');
  }, { once: true });
  image.src = assetUrl(path);
}

document.querySelector('main').dataset.gameplayStatus = GAMEPLAY_STATUS;
document.querySelector('#pair-count').textContent = gameConfig.pairs.length;
document.querySelector('#round-duration').textContent = gameConfig.roundDurationSeconds;

showAsset(document.querySelector('#header-brand'), gameConfig.cardBackImagePath, 'NawrasEdu');
showAsset(document.querySelector('#card-back-preview'), gameConfig.cardBackImagePath, 'NawrasEdu card back');
const brandPair = gameConfig.pairs.find((pair) => pair.id === 'nawras');
showAsset(document.querySelector('#pair-preview'), brandPair.imagePath, brandPair.label);
