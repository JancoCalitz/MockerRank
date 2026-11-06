import { useEffect, useState } from 'react';
import { useTheme } from '../themes/store.ts';
import { ThemeMenu } from '../themes/ThemeMenu.tsx';

export type Mode = 'exam' | 'drill' | 'gym' | 'progress' | 'data';

const MODES: [Mode, string][] = [
  ['exam', 'Full exam'],
  ['drill', 'Topic drill'],
  ['gym', 'Coding gym'],
  ['progress', 'Progress'],
  ['data', 'Packs and backups'],
];

// The 1990s theme turns the top bar into a taskbar, which has a clock at its end.
function TaskbarClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="ui-clock" dateTime={now.toISOString()}>
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </time>
  );
}

// The bar at the top of every practice screen: the logo leads home, then the practice modes and
// the theme picker. On narrow screens the modes fold into a menu.
export function ModeNav({ current, onChange }: { current: Mode; onChange: (mode: Mode) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useTheme();
  const choose = (mode: Mode) => {
    setMenuOpen(false);
    onChange(mode);
  };
  const link = (mode: Mode, label: string, extra = '') => (
    <button
      key={mode}
      type="button"
      aria-current={mode === current ? 'page' : undefined}
      className={`rounded px-3 py-1.5 text-left text-sm font-medium whitespace-nowrap ${extra} ${
        mode === current ? 'bg-accent text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
      onClick={() => choose(mode)}
    >
      {label}
    </button>
  );

  return (
    <header className="ui-topbar border-b border-slate-200 font-sans">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="app-logo mr-2 text-lg font-semibold"
          onClick={() => choose('exam')}
        >
          MockerRank
        </button>
        <nav aria-label="Practice modes" className="ui-nav hidden flex-1 gap-1 md:flex">
          {MODES.map(([mode, label]) => link(mode, label))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeMenu />
          {theme.id === 'desktop90s' && <TaskbarClock />}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mode-menu"
            className="ui-btn rounded border border-slate-300 px-2.5 py-1 text-sm font-medium md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="mode-menu"
          aria-label="Practice modes"
          className="ui-nav flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden"
        >
          {MODES.map(([mode, label]) => link(mode, label, 'w-full'))}
        </nav>
      )}
    </header>
  );
}
