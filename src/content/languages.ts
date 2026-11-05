export const LANGUAGE_IDS = [
  'csharp',
  'java',
  'cpp',
  'c',
  'javascript',
  'typescript',
  'python',
  'ruby',
  'php',
  'lua',
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export interface Language {
  label: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

// Limits follow HackerRank's published execution environment table. It lists no
// JavaScript time limit, so JavaScript uses the same 10 seconds as TypeScript.
export const LANGUAGES: Record<LanguageId, Language> = {
  csharp: { label: 'C#', timeLimitMs: 3000, memoryLimitMb: 512 },
  java: { label: 'Java 17', timeLimitMs: 4000, memoryLimitMb: 2048 },
  cpp: { label: 'C++20', timeLimitMs: 2000, memoryLimitMb: 512 },
  c: { label: 'C', timeLimitMs: 2000, memoryLimitMb: 512 },
  javascript: { label: 'JavaScript', timeLimitMs: 10000, memoryLimitMb: 512 },
  typescript: { label: 'TypeScript', timeLimitMs: 10000, memoryLimitMb: 1536 },
  python: { label: 'Python 3', timeLimitMs: 10000, memoryLimitMb: 512 },
  ruby: { label: 'Ruby', timeLimitMs: 10000, memoryLimitMb: 512 },
  php: { label: 'PHP', timeLimitMs: 9000, memoryLimitMb: 512 },
  lua: { label: 'Lua', timeLimitMs: 12000, memoryLimitMb: 512 },
};
