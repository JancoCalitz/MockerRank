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

// On and off settings kept next to the theme. Effects are a theme's moving background and
// animations; sounds are short tones when code runs and passes. Sounds start off.
export type Preference = 'effects' | 'sounds';

const PREFERENCE_DEFAULTS: Record<Preference, boolean> = { effects: true, sounds: false };

function readPreference(name: Preference): boolean {
  try {
    const saved = localStorage.getItem(`mockerrank.${name}`);
    return saved === null ? PREFERENCE_DEFAULTS[name] : saved === 'on';
  } catch {
    return PREFERENCE_DEFAULTS[name];
  }
}

const preferences: Record<Preference, boolean> = {
  effects: readPreference('effects'),
  sounds: readPreference('sounds'),
};

function applyPreferences() {
  document.documentElement.dataset.effects = preferences.effects ? 'on' : 'off';
}

applyPreferences();

export function getPreference(name: Preference): boolean {
  return preferences[name];
}

export function setPreference(name: Preference, value: boolean) {
  preferences[name] = value;
  try {
    localStorage.setItem(`mockerrank.${name}`, value ? 'on' : 'off');
  } catch {
    // The setting still applies for this visit if the browser's storage is full.
  }
  applyPreferences();
  for (const listener of listeners) listener();
}

export function usePreference(name: Preference): boolean {
  return useSyncExternalStore(subscribe, () => preferences[name]);
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
