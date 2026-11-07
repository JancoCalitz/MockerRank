import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import typescriptWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import { useState } from 'react';
import type { LanguageId } from '../content/languages.ts';
import { editorThemeName, THEMES } from '../themes/index.ts';
import { useTheme } from '../themes/store.ts';

// Use the bundled copy of Monaco, not the CDN copy this wrapper loads by default.
self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === 'typescript' || label === 'javascript' ? new typescriptWorker() : new editorWorker(),
};
loader.config({ monaco });

// Programs use Node's input APIs through the runner, which the editor's checker cannot see.
// Syntax errors still show, as the compile step reports them too.
for (const defaults of [
  monaco.typescript.typescriptDefaults,
  monaco.typescript.javascriptDefaults,
]) {
  defaults.setDiagnosticsOptions({ noSemanticValidation: true });
}

for (const theme of THEMES) {
  if (typeof theme.editor !== 'string') {
    monaco.editor.defineTheme(editorThemeName(theme), theme.editor);
  }
}

const SETTINGS_KEY = 'mockerrank.editor';

interface EditorSettings {
  fontSize: number;
  tabSize: number;
  // 'app' follows the app's theme; the others are Monaco's own light and dark themes.
  theme: 'app' | 'light' | 'vs-dark';
}

const DEFAULT_SETTINGS: EditorSettings = { fontSize: 14, tabSize: 4, theme: 'app' };

function loadSettings(): EditorSettings {
  try {
    const saved = {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'),
    };
    return ['app', 'light', 'vs-dark'].includes(saved.theme) ? saved : { ...saved, theme: 'app' };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface CodeEditorProps {
  path: string;
  language: LanguageId;
  code: string;
  onChange: (code: string) => void;
  onClipboard: (type: 'copy' | 'paste') => void;
}

export function CodeEditor({ path, language, code, onChange, onClipboard }: CodeEditorProps) {
  const [settings, setSettings] = useState(loadSettings);
  const appTheme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const change = (next: Partial<EditorSettings>) => {
    const updated = { ...settings, ...next };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* On a phone the settings fold behind a button, to leave the editor more room. */}
      <button
        type="button"
        aria-expanded={settingsOpen}
        className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-left text-xs sm:hidden"
        onClick={() => setSettingsOpen(!settingsOpen)}
      >
        Editor settings {settingsOpen ? '▴' : '▾'}
      </button>
      <div
        className={`${settingsOpen ? 'flex' : 'hidden'} flex-wrap items-center justify-end gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-2 py-1 text-xs sm:flex`}
      >
        <label>
          Font size{' '}
          <select
            className="rounded border border-slate-300 bg-white"
            value={settings.fontSize}
            onChange={(event) => change({ fontSize: Number(event.target.value) })}
          >
            {[12, 13, 14, 16, 18, 20].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          Tab size{' '}
          <select
            className="rounded border border-slate-300 bg-white"
            value={settings.tabSize}
            onChange={(event) => change({ tabSize: Number(event.target.value) })}
          >
            {[2, 4, 8].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          Theme{' '}
          <select
            className="rounded border border-slate-300 bg-white"
            value={settings.theme}
            onChange={(event) => change({ theme: event.target.value as EditorSettings['theme'] })}
          >
            <option value="app">Match app theme</option>
            <option value="light">Light</option>
            <option value="vs-dark">Dark</option>
          </select>
        </label>
      </div>
      <div
        className="min-h-0 flex-1"
        data-testid="editor"
        onCopyCapture={() => onClipboard('copy')}
        onCutCapture={() => onClipboard('copy')}
        onPasteCapture={() => onClipboard('paste')}
      >
        <Editor
          path={path}
          language={language}
          defaultValue={code}
          theme={settings.theme === 'app' ? editorThemeName(appTheme) : settings.theme}
          loading="Loading the editor…"
          onChange={(value) => onChange(value ?? '')}
          options={{
            fontSize: settings.fontSize,
            tabSize: settings.tabSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
