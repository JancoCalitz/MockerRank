import { assembleSource, limitsFor, outputMatches } from '../content/judging.ts';
import { LANGUAGES, type LanguageId } from '../content/languages.ts';
import { readTestFile } from '../content/lock.ts';
import type { CodingProblem } from '../content/schema.ts';
import { JavaDriver } from './java-driver.ts';
import {
  OUTPUT_LIMIT_BYTES,
  type RunLimits,
  type RunResult,
  type RuntimeDriver,
  type RunStatus,
} from './types.ts';
import { assetsUrl, WorkerDriver } from './worker-driver.ts';

// Vite needs each new Worker(new URL(...)) written out to bundle the worker.
const javascriptWorker = (name: string) => () =>
  new Worker(new URL('./javascript.worker.ts', import.meta.url), { type: 'module', name });
const clangWorker = (name: string) => () =>
  new Worker(new URL('./clang.worker.ts', import.meta.url), { type: 'module', name });

const DRIVERS: Record<LanguageId, () => RuntimeDriver> = {
  javascript: () => new WorkerDriver(javascriptWorker('javascript')),
  typescript: () => new WorkerDriver(javascriptWorker('typescript')),
  cpp: () => new WorkerDriver(clangWorker('cpp')),
  c: () => new WorkerDriver(clangWorker('c')),
  python: () =>
    new WorkerDriver(
      () => new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' }),
    ),
  csharp: () =>
    new WorkerDriver(
      ({ memoryLimitMb }) =>
        new Worker(
          `${assetsUrl()}csharp/worker.js?memoryLimitMb=${memoryLimitMb}&outputLimit=${OUTPUT_LIMIT_BYTES}`,
          { type: 'module' },
        ),
    ),
  java: () => new JavaDriver(),
};

export type Verdict = 'accepted' | 'wrong-answer' | Exclude<RunStatus, 'ok'>;

export interface TestResult extends RunResult {
  verdict: Verdict;
}

export type JudgeResult =
  | { compiled: false; compileOutput: string; tests: [] }
  | { compiled: true; compileOutput: ''; tests: TestResult[] };

export interface TestCase {
  input: string;
  output: string;
}

// WebAssembly is slower than native code, so time limits scale by language.
export function scaledLimits(language: LanguageId, limits: RunLimits): RunLimits {
  return {
    ...limits,
    timeLimitMs: limits.timeLimitMs * LANGUAGES[language].timeMultiplier,
  };
}

// Runs one job at a time, so several programs do not compete for this computer.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job, job);
  queue = result.catch(() => {});
  return result;
}

export function runProgram(
  language: LanguageId,
  source: string,
  stdin: string,
  limits: RunLimits,
): Promise<{ compiled: boolean; compileOutput: string; result: RunResult | null }> {
  return enqueue(async () => {
    const driver = DRIVERS[language]();
    const scaled = scaledLimits(language, limits);
    try {
      const compile = await driver.compile(source, scaled);
      if (!compile.ok) return { compiled: false, compileOutput: compile.output, result: null };
      return { compiled: true, compileOutput: '', result: await driver.run(stdin, scaled) };
    } finally {
      driver.dispose();
    }
  });
}

export function judge(
  problem: CodingProblem,
  language: LanguageId,
  code: string,
  tests: readonly TestCase[],
  onProgress?: (done: number, total: number) => void,
): Promise<JudgeResult> {
  return enqueue(async () => {
    const driver = DRIVERS[language]();
    const limits = scaledLimits(language, limitsFor(problem, language));
    try {
      const compile = await driver.compile(assembleSource(problem, language, code), limits);
      if (!compile.ok) return { compiled: false, compileOutput: compile.output, tests: [] };

      const results: TestResult[] = [];
      for (const test of tests) {
        const result = await driver.run(test.input, limits);
        const passed =
          result.status === 'ok' &&
          outputMatches(problem.checker, {
            input: test.input,
            expected: test.output,
            actual: result.stdout,
          });
        const verdict: Verdict =
          result.status !== 'ok' ? result.status : passed ? 'accepted' : 'wrong-answer';
        results.push({ ...result, verdict });
        onProgress?.(results.length, tests.length);
      }
      return { compiled: true, compileOutput: '', tests: results };
    } finally {
      driver.dispose();
    }
  });
}

function testFileUrl(name: string): URL {
  return new URL(`tests/${name}`, document.baseURI);
}

async function fetchTestFile(name: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(testFileUrl(name));
  } catch {
    throw new Error('Could not download the tests. Check your internet connection, and try again.');
  }
  if (!response.ok) throw new Error(`Could not download the test file ${name}.`);
  return readTestFile(response);
}

// Every test in submission order, downloading large ones from their files.
export async function allTests(problem: CodingProblem): Promise<TestCase[]> {
  const hidden = await Promise.all(
    problem.hiddenTests.map(async (test) => {
      if (!('file' in test)) return test;
      const [input, output] = await Promise.all([
        fetchTestFile(`${test.file}.in`),
        fetchTestFile(`${test.file}.out`),
      ]);
      return { input, output };
    }),
  );
  return [...problem.sampleTests, ...hidden];
}

// Run Code: sample tests only, with full details shown to the candidate.
export function runCode(problem: CodingProblem, language: LanguageId, code: string) {
  return judge(problem, language, code, problem.sampleTests);
}

// Submit: every test. What the candidate may see of hidden tests is up to the UI.
export async function submit(
  problem: CodingProblem,
  language: LanguageId,
  code: string,
  onProgress?: (done: number, total: number) => void,
) {
  return judge(problem, language, code, await allTests(problem), onProgress);
}
