import type { editor } from 'monaco-editor';

// Each theme's colours, fonts, and decorations live in src/themes/<id>.css, scoped to
// [data-theme="<id>"] on <html>. This registry holds what scripts need: the label, whether the
// theme is light or dark, the code editor theme, and a few colours for the picker's swatch.
export interface Theme {
  id: string;
  label: string;
  scheme: 'light' | 'dark';
  // Background, panel, and accent colours, shown in the theme picker.
  swatch: [string, string, string];
  // A built-in Monaco theme, or a definition registered as `app-<id>`.
  editor: 'vs' | 'vs-dark' | editor.IStandaloneThemeData;
}

interface EditorColours {
  background: string;
  foreground: string;
  lineHighlight: string;
  selection: string;
  cursor: string;
  lineNumber: string;
  activeLineNumber: string;
  indentGuide: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  delimiter: string;
}

// A Monaco theme from a palette. Monaco wants token colours without the leading #.
function editorTheme(base: 'vs' | 'vs-dark', c: EditorColours): editor.IStandaloneThemeData {
  const token = (colour: string) => colour.slice(1);
  return {
    base,
    inherit: true,
    rules: [
      { token: 'comment', foreground: token(c.comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: token(c.keyword) },
      { token: 'string', foreground: token(c.string) },
      { token: 'number', foreground: token(c.number) },
      { token: 'type', foreground: token(c.type) },
      { token: 'type.identifier', foreground: token(c.type) },
      { token: 'delimiter', foreground: token(c.delimiter) },
    ],
    colors: {
      'editor.background': c.background,
      'editor.foreground': c.foreground,
      'editor.lineHighlightBackground': c.lineHighlight,
      'editor.selectionBackground': c.selection,
      'editorCursor.foreground': c.cursor,
      'editorLineNumber.foreground': c.lineNumber,
      'editorLineNumber.activeForeground': c.activeLineNumber,
      'editorIndentGuide.background1': c.indentGuide,
    },
  };
}

// In the order the theme picker lists them.
export const THEMES: Theme[] = [
  {
    id: 'classic',
    label: 'Classic',
    scheme: 'light',
    swatch: ['#ffffff', '#f8fafc', '#047857'],
    editor: 'vs',
  },
  {
    id: 'diner50s',
    label: '1950s · Atomic Diner',
    scheme: 'dark',
    swatch: ['#0b1630', '#40e0d0', '#ff4f6a'],
    editor: editorTheme('vs-dark', {
      background: '#0d1a38',
      foreground: '#fbf3dc',
      lineHighlight: '#16264f',
      selection: '#40e0d044',
      cursor: '#ff4f6a',
      lineNumber: '#3f5a96',
      activeLineNumber: '#40e0d0',
      indentGuide: '#1d3060',
      comment: '#8a9cc8',
      keyword: '#40e0d0',
      string: '#ff8c9c',
      number: '#ffcd4f',
      type: '#c2f6f0',
      delimiter: '#b3bfdc',
    }),
  },
  {
    id: 'mod60s',
    label: '1960s · Mod Pop-Art',
    scheme: 'light',
    swatch: ['#fffaf0', '#ff6b1a', '#00897b'],
    editor: editorTheme('vs', {
      background: '#ffffff',
      foreground: '#000000',
      lineHighlight: '#fff3d6',
      selection: '#f2b70566',
      cursor: '#ff6b1a',
      lineNumber: '#9e9e9e',
      activeLineNumber: '#000000',
      indentGuide: '#e0e0e0',
      comment: '#6b6b6b',
      keyword: '#d94f00',
      string: '#00796b',
      number: '#a86f00',
      type: '#00695c',
      delimiter: '#2e2e2e',
    }),
  },
  {
    id: 'groovy70s',
    label: '1970s · Groovy Sunset',
    scheme: 'light',
    swatch: ['#f6ead2', '#c8541a', '#788c32'],
    editor: editorTheme('vs', {
      background: '#fff7e8',
      foreground: '#2e1c0e',
      lineHighlight: '#f3e4c8',
      selection: '#e0aa2655',
      cursor: '#c8541a',
      lineNumber: '#b08a58',
      activeLineNumber: '#8c2d0e',
      indentGuide: '#e6cfa6',
      comment: '#8c6a40',
      keyword: '#a83812',
      string: '#5f7127',
      number: '#a8780e',
      type: '#86600d',
      delimiter: '#563c22',
    }),
  },
  {
    id: 'retro80s',
    label: '1980s · Retro',
    scheme: 'dark',
    swatch: ['#1a0838', '#170d30', '#ff2bd6'],
    // Neon syntax colours on a deep violet background.
    editor: editorTheme('vs-dark', {
      background: '#120827',
      foreground: '#f5f0ff',
      lineHighlight: '#1f1440',
      selection: '#ff2bd655',
      cursor: '#2de2e6',
      lineNumber: '#5b4596',
      activeLineNumber: '#ff2bd6',
      indentGuide: '#2a1b52',
      comment: '#8a7bb8',
      keyword: '#ff2bd6',
      string: '#ffd319',
      number: '#ff9f43',
      type: '#2de2e6',
      delimiter: '#b9abe0',
    }),
  },
  {
    id: 'desktop90s',
    label: '1990s · Desktop',
    scheme: 'light',
    swatch: ['#008080', '#c0c0c0', '#000080'],
    editor: editorTheme('vs', {
      background: '#ffffff',
      foreground: '#000000',
      lineHighlight: '#ffffff',
      selection: '#00008055',
      cursor: '#000000',
      lineNumber: '#808080',
      activeLineNumber: '#000080',
      indentGuide: '#dfdfdf',
      comment: '#008000',
      keyword: '#0000ff',
      string: '#800000',
      number: '#800080',
      type: '#008080',
      delimiter: '#000000',
    }),
  },
  {
    id: 'aero00s',
    label: '2000s · Frutiger Aero',
    scheme: 'light',
    swatch: ['#7fc8ff', '#ffffff', '#7ed321'],
    editor: editorTheme('vs', {
      background: '#fbfdff',
      foreground: '#0f2a44',
      lineHighlight: '#e8f5ff',
      selection: '#1e9be844',
      cursor: '#1e9be8',
      lineNumber: '#8fb3cf',
      activeLineNumber: '#0b74c4',
      indentGuide: '#dcebf7',
      comment: '#6f8ba3',
      keyword: '#0b74c4',
      string: '#3f8f12',
      number: '#c25e00',
      type: '#0a8f8f',
      delimiter: '#3c5a75',
    }),
  },
  {
    id: 'flat10s',
    label: '2010s · Flat Material',
    scheme: 'light',
    swatch: ['#eceff1', '#ffffff', '#3f51b5'],
    editor: editorTheme('vs', {
      background: '#ffffff',
      foreground: '#263238',
      lineHighlight: '#f5f7f8',
      selection: '#3f51b533',
      cursor: '#3f51b5',
      lineNumber: '#b0bec5',
      activeLineNumber: '#3f51b5',
      indentGuide: '#eceff1',
      comment: '#90a4ae',
      keyword: '#3f51b5',
      string: '#2e7d32',
      number: '#d84315',
      type: '#00838f',
      delimiter: '#546e7a',
    }),
  },
  {
    id: 'aurora20s',
    label: '2020s · Aurora Glass',
    scheme: 'dark',
    swatch: ['#0a0b14', '#8b7cf6', '#5eead4'],
    editor: editorTheme('vs-dark', {
      background: '#0f1120',
      foreground: '#f4f5fa',
      lineHighlight: '#171a2e',
      selection: '#8b7cf655',
      cursor: '#5eead4',
      lineNumber: '#4b5070',
      activeLineNumber: '#c4b5fd',
      indentGuide: '#1c2036',
      comment: '#7b8099',
      keyword: '#c4b5fd',
      string: '#5eead4',
      number: '#f9a8d4',
      type: '#93c5fd',
      delimiter: '#b6bbd0',
    }),
  },
  {
    id: 'aurora20s-light',
    label: '2020s · Aurora Glass (light)',
    scheme: 'light',
    swatch: ['#f5f6fb', '#7c3aed', '#0f766e'],
    editor: editorTheme('vs', {
      background: '#fbfbfe',
      foreground: '#1e1b3a',
      lineHighlight: '#f1f0fb',
      selection: '#7c3aed33',
      cursor: '#7c3aed',
      lineNumber: '#a5a3c4',
      activeLineNumber: '#7c3aed',
      indentGuide: '#ebeaf5',
      comment: '#8a88a8',
      keyword: '#7c3aed',
      string: '#0f766e',
      number: '#be185d',
      type: '#1d4ed8',
      delimiter: '#4b4870',
    }),
  },
];

export const DEFAULT_THEME_ID = 'retro80s';

export function themeById(id: string | null | undefined): Theme {
  return (
    THEMES.find((theme) => theme.id === id) ?? THEMES.find(({ id }) => id === DEFAULT_THEME_ID)!
  );
}

// The Monaco theme name to use for an app theme.
export function editorThemeName(theme: Theme): string {
  return typeof theme.editor === 'string' ? theme.editor : `app-${theme.id}`;
}
