export const LANGUAGE_IDS = [
  'csharp',
  'java',
  'cpp',
  'c',
  'javascript',
  'typescript',
  'python',
] as const;

export type LanguageId = (typeof LANGUAGE_IDS)[number];

export interface Language {
  label: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  // How much longer than timeLimitMs a program gets, because WebAssembly is slower than
  // the native code the time limit is based on.
  timeMultiplier: number;
}

// Limits follow HackerRank's published execution environment table, except for JavaScript
// and TypeScript. A browser cannot measure a worker's object memory, and a runaway program
// that reaches about 5 GB freezes the whole tab, even after its worker is terminated. Testing
// found 5 seconds stops one in time, and honest solutions in these languages run quickly.
// To add a language: add it here, and add its runtime to src/runner/judge.ts.
export const LANGUAGES: Record<LanguageId, Language> = {
  csharp: { label: 'C#', timeLimitMs: 3000, memoryLimitMb: 512, timeMultiplier: 5 },
  java: { label: 'Java 17', timeLimitMs: 4000, memoryLimitMb: 2048, timeMultiplier: 5 },
  cpp: { label: 'C++20', timeLimitMs: 2000, memoryLimitMb: 512, timeMultiplier: 2 },
  c: { label: 'C', timeLimitMs: 2000, memoryLimitMb: 512, timeMultiplier: 2 },
  javascript: { label: 'JavaScript', timeLimitMs: 5000, memoryLimitMb: 512, timeMultiplier: 1 },
  typescript: { label: 'TypeScript', timeLimitMs: 5000, memoryLimitMb: 1536, timeMultiplier: 1 },
  python: { label: 'Python 3', timeLimitMs: 10000, memoryLimitMb: 512, timeMultiplier: 2 },
};
