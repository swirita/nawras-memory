// Landing-only SVG artwork. CSS handles motion; JS runs only on lifecycle/layout changes.
export function createLandingParticles(svg, landing) {
  const ns = 'http://www.w3.org/2000/svg';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 600px)');
  const make = (tag, attrs, parent) => {
    const node = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    parent.append(node);
    return node;
  };
  const defs = make('defs', {}, svg);
  // A vector clip avoids a full-screen raster mask on high-density displays.
  const clip = make('clipPath', { id: 'landing-quiet-clip', clipPathUnits: 'userSpaceOnUse' }, defs);
  const clipShape = make('path', { 'clip-rule': 'evenodd', 'fill-rule': 'evenodd' }, clip);
  const decoration = make('g', { 'clip-path': 'url(#landing-quiet-clip)' }, svg);
  let width = 0;
  let height = 0;
  let disposed = false;
  let inView = true;
  let pageActive = true;
  let layoutKey = '';
  const stage = landing.parentElement;
  const container = svg.parentElement;

  function visible() {
    return !disposed && pageActive && inView && !document.hidden && landing.isConnected &&
      landing.getClientRects().length > 0 &&
      getComputedStyle(landing).visibility !== 'hidden';
  }

  function sync() {
    const active = visible();
    const motionActive = String(active && !reducedMotion.matches);
    if (container.dataset.active !== motionActive) container.dataset.active = motionActive;
    if (container.hidden === active) container.hidden = !active;
    if (stage.classList.contains('landing-active') !== active) stage.classList.toggle('landing-active', active);
  }
  function onPageHide() { pageActive = false; sync(); }
  function onPageShow() { pageActive = true; sync(); }

  function resize() {
    if (disposed || !landing.getClientRects().length) return;
    const stageBounds = stage.getBoundingClientRect();
    width = stageBounds.width;
    height = stageBounds.height;
    const content = [...landing.children].map(node => node.getBoundingClientRect());
    const quiet = {
      left: Math.min(...content.map(r => r.left)) - stageBounds.left - 40,
      right: Math.max(...content.map(r => r.right)) - stageBounds.left + 40,
      top: Math.min(...content.map(r => r.top)) - stageBounds.top - 22,
      bottom: Math.max(...content.map(r => r.bottom)) - stageBounds.top + 36,
    };
    const { left, right, top, bottom } = quiet;
    const nextLayout = [width, height, left, right, top, bottom, mobile.matches].join(',');
    if (nextLayout === layoutKey) { sync(); return; }
    layoutKey = nextLayout;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const r = 40;
    clipShape.setAttribute('d',
      `M 0 0 H ${width} V ${height} H 0 Z ` +
      `M ${left + r} ${top} H ${right - r} Q ${right} ${top} ${right} ${top + r} ` +
      `V ${bottom - r} Q ${right} ${bottom} ${right - r} ${bottom} ` +
      `H ${left + r} Q ${left} ${bottom} ${left} ${bottom - r} ` +
      `V ${top + r} Q ${left} ${top} ${left + r} ${top} Z`);
    decoration.replaceChildren();
    // Stable positions avoid random jumps when a viewport or the logo resizes.
    // The same quiet-area clip protects text and controls throughout each drift.
    const positions = [
      [8, 15], [24, 8], [73, 13], [92, 22], [4, 42], [96, 49],
      [12, 74], [84, 82], [32, 92], [68, 95], [18, 30], [82, 35],
      [7, 91], [93, 67], [40, 12], [59, 85],
      [31, 23], [65, 6], [88, 53], [15, 57], [47, 94], [77, 71],
      [3, 64], [97, 9], [55, 18], [23, 83], [71, 90], [90, 93],
      [11, 5], [36, 7], [81, 7], [61, 28], [6, 27], [94, 36],
      [26, 42], [75, 46], [10, 52], [91, 59], [21, 68], [80, 63],
      [5, 81], [38, 80], [57, 91], [95, 85], [17, 95], [48, 5],
      [69, 76], [86, 17],
    ];
    positions.slice(0, mobile.matches ? 24 : 48).forEach(([x, y], i) => {
      const opacity = 0.22 + (i % 4) * 0.03;
      const driftX = (mobile.matches ? 24 : 36) + (i % 5) * 6;
      const driftY = 22 + (i % 4) * 7;
      let particleY = height * y / 100;
      // Seed particles outside the quiet area so the extra dots stay visible,
      // including on mobile where the central content spans most of the width.
      if (width * x / 100 > left && width * x / 100 < right && particleY > top && particleY < bottom) {
        particleY = i % 2 ? bottom + (height - bottom) * 0.6 : top * 0.4;
      }
      make('circle', {
        class: 'landing-particle', cx: width * x / 100, cy: particleY,
        r: 1 + (i % 4) * 0.5, fill: i % 3 === 1 ? '#a296d7' : '#69c5e1',
        style: `--period:${16 + i % 7}s;--delay:-${i * 2.7}s;--drift-x:${i % 2 ? -driftX : driftX}px;--drift-y:${i % 3 ? driftY : -driftY}px;--particle-opacity:${opacity};--particle-soft-opacity:${opacity * 0.8}`,
      }, decoration);
    });
    sync();
  }

  function dispose() {
    disposed = true;
    container.dataset.active = 'false';
    container.hidden = true;
    stage.classList.remove('landing-active');
    observer.disconnect();
    sizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', sync);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    reducedMotion.removeEventListener('change', sync);
    svg.replaceChildren();
  }
  // Automatic unmount cleanup; explicit cleanup remains available to gameplay.
  const observer = new MutationObserver(() => {
    if (!landing.isConnected) dispose();
    else { sync(); resize(); }
  });
  // Card, score, timer and dialog mutations cannot change landing geometry.
  observer.observe(landing, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['hidden', 'class', 'style'],
  });
  // Detect removal of the landing or its stage without watching round subtrees.
  observer.observe(stage, { childList: true });
  observer.observe(stage.parentElement, { childList: true });
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  });
  intersectionObserver.observe(landing);
  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(landing);
  sizeObserver.observe(landing.parentElement);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  reducedMotion.addEventListener('change', sync);
  resize();
  return dispose;
}
