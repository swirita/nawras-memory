// Only the latest requested mode may commit or finish an animation.
export function createModeSwitcher({ form, startButton, reducedMotion, apply }) {
  let generation = 0;
  let timer;
  let animation;
  let desired = 'solo';
  function finish() {
    generation++;
    clearTimeout(timer);
    animation?.cancel();
    apply(desired);
    form.inert = false;
    startButton.disabled = false;
  }
  function switchTo(mode) {
    desired = mode;
    // Retain any space currently occupied by validation messages as well.
    form.style.minHeight = `${form.getBoundingClientRect().height}px`;
    const opacity = getComputedStyle(form).opacity;
    generation++;
    const current = generation;
    clearTimeout(timer);
    animation?.cancel();
    if (reducedMotion.matches) { finish(); return; }
    form.inert = true;
    startButton.disabled = true;
    animation = form.animate([{ opacity, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 120, fill: 'forwards', easing: 'ease-out' });
    timer = setTimeout(() => {
      if (current !== generation) return;
      animation.cancel();
      apply(desired);
      animation = form.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 130, easing: 'ease-out' });
      animation.finished.then(() => {
        if (current !== generation) return;
        form.inert = false;
        startButton.disabled = false;
      }).catch(() => {});
    }, 120);
  }
  return { switchTo, finish };
}
