import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { THEMES, type Theme } from './index.ts';
import { setTheme, useTheme } from './store.ts';

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

// A button that opens a list of themes. Choosing one applies it at once and remembers it.
export function ThemeMenu() {
  const current = useTheme();
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
      items.current[(next + THEMES.length) % THEMES.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(THEMES.length - 1);
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
        Theme
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Themes"
          className="ui-card absolute right-0 z-30 mt-1 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
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
        </div>
      )}
    </div>
  );
}
