import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { THEMES, type Theme } from './index.ts';
import { setPreference, setTheme, usePreference, useTheme, type Preference } from './store.ts';

const SETTINGS: [Preference, string][] = [
  ['effects', 'Background effects'],
  ['sounds', 'Sounds'],
];
// Every focusable item: the themes, then the settings.
const ITEM_COUNT = THEMES.length + SETTINGS.length;

function Swatch({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 overflow-hidden rounded border border-slate-300"
    >
      {theme.swatch.map((colour) => (
        <span key={colour} className="h-4 w-2.5" style={{ background: colour }} />
      ))}
    </span>
  );
}

// A button that opens a list of themes, then the effects and sounds settings. Choosing a theme
// applies it at once and remembers it.
export function ThemeMenu() {
  const current = useTheme();
  const settings = { effects: usePreference('effects'), sounds: usePreference('sounds') };
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    items.current[THEMES.indexOf(current)]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
    // Focus moves only when the menu opens, not each time the theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent) => {
    const index = items.current.findIndex((item) => item === document.activeElement);
    const move = (next: number) => {
      event.preventDefault();
      items.current[(next + ITEM_COUNT) % ITEM_COUNT]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(ITEM_COUNT - 1);
    else if (event.key === 'Escape' || event.key === 'Tab') close();
  };

  return (
    <div ref={container} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="ui-btn flex items-center gap-2 rounded border border-slate-300 px-2.5 py-1 text-sm font-medium hover:bg-slate-100"
        onClick={() => setOpen(!open)}
      >
        <Swatch theme={current} />
        {/* On a phone the swatch alone shows, to leave room in the top bar. Screen readers still
            hear "Theme". */}
        <span className="sr-only sm:not-sr-only">Theme</span>
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Themes"
          className="ui-card absolute right-0 z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          onKeyDown={onMenuKey}
        >
          {THEMES.map((theme, index) => (
            <button
              key={theme.id}
              ref={(item) => {
                items.current[index] = item;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={theme === current}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 focus:bg-slate-100 ${
                theme === current ? 'font-semibold' : ''
              }`}
              onClick={() => {
                setTheme(theme.id);
                close();
              }}
            >
              <Swatch theme={theme} />
              <span className="flex-1">{theme.label}</span>
              {theme === current && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <div role="separator" className="my-1 border-t border-slate-200" />
          {SETTINGS.map(([name, label], index) => (
            <button
              key={name}
              ref={(item) => {
                items.current[THEMES.length + index] = item;
              }}
              type="button"
              role="menuitemcheckbox"
              aria-checked={settings[name]}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 focus:bg-slate-100"
              onClick={() => setPreference(name, !settings[name])}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-7 shrink-0 items-center rounded-full border border-slate-300 p-0.5 ${
                  settings[name] ? 'justify-end bg-accent' : 'justify-start bg-slate-100'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffffff] shadow" />
              </span>
              <span className="flex-1">{label}</span>
              <span className="text-xs text-slate-500">{settings[name] ? 'On' : 'Off'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
