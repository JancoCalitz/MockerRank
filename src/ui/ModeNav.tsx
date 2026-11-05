export type Mode = 'exam' | 'drill' | 'gym' | 'data';

const MODES: [Mode, string][] = [
  ['exam', 'Full exam'],
  ['drill', 'Topic drill'],
  ['gym', 'Coding gym'],
  ['data', 'Packs and backups'],
];

export function ModeNav({ current, onChange }: { current: Mode; onChange: (mode: Mode) => void }) {
  return (
    <nav
      aria-label="Practice modes"
      className="mx-auto flex max-w-3xl flex-wrap gap-1 px-8 pt-6 font-sans"
    >
      {MODES.map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          aria-current={mode === current ? 'page' : undefined}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            mode === current ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
          onClick={() => onChange(mode)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
