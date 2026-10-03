// One controller for the whole document, independent of round/screen changes.
export function createFullscreenShortcut(doc = document) {
  const root = doc.documentElement;
  let fullscreen = Boolean(doc.fullscreenElement);
  let pending = false;
  let disposed = false;

  function sync() {
    fullscreen = Boolean(doc.fullscreenElement);
  }

  function isEditable(node) {
    return node?.isContentEditable || node?.matches?.('input, textarea, select, [role="textbox"]');
  }

  async function onKeydown(event) {
    if (disposed || pending || event.defaultPrevented || event.repeat || event.isComposing
      || event.ctrlKey || event.altKey || event.metaKey
      || event.key?.toLowerCase() !== 'f') return;
    if (doc.designMode === 'on' || isEditable(doc.activeElement)
      || (event.composedPath?.() ?? [event.target]).some(isEditable)) return;

    // The native property may change just before fullscreenchange is delivered.
    const exiting = Boolean(doc.fullscreenElement);
    const target = exiting ? doc : root;
    const action = exiting ? doc.exitFullscreen : root.requestFullscreen;
    if (typeof action !== 'function' || (!exiting && doc.fullscreenEnabled === false)) return;

    event.preventDefault();
    pending = true;
    try {
      // Call immediately within the key's user activation; state comes from the event.
      await action.call(target);
    } catch {
      // Unavailable/denied fullscreen leaves the current screen and round intact.
    } finally {
      pending = false;
    }
  }

  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('keydown', onKeydown);
  return {
    isFullscreen: () => fullscreen,
    dispose() {
      disposed = true;
      doc.removeEventListener('keydown', onKeydown);
      doc.removeEventListener('fullscreenchange', sync);
    },
  };
}
