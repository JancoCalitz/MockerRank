import { useEffect, useState } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import { eventNow } from '../attempt/integrity.ts';

const RESIZE_SETTLE_MS = 500;

function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

// Records what the browser reports during an attempt. It only ever observes: it does not block
// anything, and it records that things happened, never what was copied or pasted.
export function useIntegrityTracking(update: UpdateAttempt): boolean {
  const [fullscreen, setFullscreen] = useState(isFullscreen);

  useEffect(() => {
    let resizeTimer = 0;
    const onBlur = () => update(eventNow('focus-lost'));
    const onFocus = () => update(eventNow('focus-returned'));
    const onVisibility = () =>
      update(eventNow(document.visibilityState === 'hidden' ? 'tab-hidden' : 'tab-visible'));
    const onContextMenu = () => update(eventNow('right-click'));
    // Dragging a window edge fires many events, and one drag should count once.
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => update(eventNow('resize')), RESIZE_SETTLE_MS);
    };
    const onFullscreen = () => {
      const now = isFullscreen();
      setFullscreen(now);
      update(eventNow(now ? 'fullscreen-enter' : 'fullscreen-exit'));
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    // Capture, because the editor handles right-clicks itself and may stop them spreading.
    window.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [update]);

  return fullscreen;
}

export function enterFullscreen(): void {
  // A browser can refuse, and the exam screen then offers a button to try again.
  void document.documentElement.requestFullscreen?.().catch(() => {});
}
