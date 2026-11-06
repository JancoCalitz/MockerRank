import { useEffect, useSyncExternalStore } from 'react';
import { themeById, type Theme } from './index.ts';

const THEME_KEY = 'mockerrank.theme';

function readTheme(): Theme {
  try {
    return themeById(localStorage.getItem(THEME_KEY));
  } catch {
    return themeById(null);
  }
}

let current = readTheme();
const listeners = new Set<() => void>();

function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme.id;
}

apply(current);

export function setTheme(id: string) {
  current = themeById(id);
  try {
    localStorage.setItem(THEME_KEY, current.id);
  } catch {
    // The theme still applies for this visit if the browser's storage is full.
  }
  apply(current);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current);
}

// Screens where someone is working against the clock or on a problem turn off background motion,
// so a theme's animations never compete for attention. Themes pause them under [data-calm].
let calmScreens = 0;

export function useCalm() {
  useEffect(() => {
    calmScreens += 1;
    document.documentElement.dataset.calm = 'true';
    return () => {
      calmScreens -= 1;
      if (calmScreens === 0) delete document.documentElement.dataset.calm;
    };
  }, []);
}

// For screens that are calm only in some states, where a hook cannot be called conditionally.
export function Calm() {
  useCalm();
  return null;
}
