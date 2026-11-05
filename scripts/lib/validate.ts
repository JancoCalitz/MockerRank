import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { assembleSource, limitsFor, outputMatches } from '../../src/content/judging.ts';
import { LANGUAGES, type LanguageId } from '../../src/content/languages.ts';
import {
  codingSchema,
  examSchema,
  mcqSchema,
  type CodingProblem,
  type Exam,
  type Mcq,
} from '../../src/content/schema.ts';
import { detectRuntimes, runReference } from './reference-runner.ts';

const SNIPPET_LENGTH = 200;

export interface ValidationReport {
  errors: string[];
  // Reference solutions that exist but could not be run on this machine.
  skipped: string[];
  counts: { mcq: number; coding: number; exams: number; referenceRuns: number };
}

interface Loaded<T> {
  file: string;
  item: T;
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (text, part) =>
      typeof part === 'number' ? `${text}[${part}]` : `${text}${text ? '.' : ''}${String(part)}`,
    '',
  );
}

function snippet(text: string): string {
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH)}...` : text;
}

export function validateContent(contentDir: string): ValidationReport {
  const errors: string[] = [];
  const skipped: string[] = [];
  let referenceRuns = 0;

  if (!existsSync(contentDir)) {
    errors.push(`${contentDir}: content folder not found`);
  }

  function readDir(subdir: string): { file: string; data: unknown }[] {
    const dir = join(contentDir, subdir);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((name) => /\.ya?ml$/.test(name));
    return files.sort().flatMap((name) => {
      const path = join(dir, name);
      const file = relative(process.cwd(), path).replaceAll('\\', '/');
      try {
        return [{ file, data: parseYaml(readFileSync(path, 'utf8')) as unknown }];
      } catch (error) {
        errors.push(`${file}: invalid YAML: ${(error as Error).message}`);
        return [];
      }
    });
  }

  function check<T>(
    file: string,
    schema: z.ZodType<T>,
    data: unknown,
    at: PropertyKey[] = [],
  ): Loaded<T>[] {
    const parsed = schema.safeParse(data);
    if (parsed.success) return [{ file, item: parsed.data }];
    for (const issue of parsed.error.issues) {
      errors.push(`${file}: ${formatPath([...at, ...issue.path]) || '(file)'} ${issue.message}`);
    }
    return [];
  }

  // Each question is checked separately, so one bad question leaves the rest of its file
  // available for the duplicate and exam checks.
  const mcqs: Loaded<Mcq>[] = readDir('mcq').flatMap(({ file, data }) => {
    if (Array.isArray(data)) return data.flatMap((mcq, i) => check(file, mcqSchema, mcq, [i]));
    errors.push(`${file}: must be a list of questions`);
    return [];
  });
  const coding = readDir('coding').flatMap(({ file, data }) => check(file, codingSchema, data));
  const exams = readDir('exams').flatMap(({ file, data }) => check(file, examSchema, data));

  const seen = new Map<string, string>();
  for (const { file, item } of [...mcqs, ...coding, ...exams]) {
    const first = seen.get(item.id);
    if (first) errors.push(`${file}: duplicate id "${item.id}", already used in ${first}`);
    else seen.set(item.id, file);
  }

  checkExams(exams, mcqs, coding, errors);

  const runtimes = detectRuntimes();

  function checkSolution(file: string, problem: CodingProblem, language: LanguageId, code: string) {
    const runtime = runtimes[language]!;
    const source = assembleSource(problem, language, code);
    const { timeLimitMs } = limitsFor(problem, language);
    const tests = [
      ...problem.sampleTests.map((test, i) => ({ ...test, name: `sample test ${i + 1}` })),
      ...problem.hiddenTests.map((test, i) => ({ ...test, name: `hidden test ${i + 1}` })),
    ];
    for (const test of tests) {
      referenceRuns++;
      const prefix = `${file}: ${LANGUAGES[language].label} reference solution failed ${test.name}:`;
      const result = runReference(runtime, source, test.input, timeLimitMs);
      if (result.timedOut) {
        errors.push(`${prefix} exceeded the ${timeLimitMs} ms time limit`);
        return;
      }
      if (result.exitCode !== 0) {
        errors.push(`${prefix} exited with ${result.exitCode}: ${snippet(result.stderr.trim())}`);
        return;
      }
      const inputs = { input: test.input, expected: test.output, actual: result.stdout };
      if (!outputMatches(problem.checker, inputs)) {
        errors.push(
          `${prefix} wrong answer\n  expected: ${snippet(test.output.trim())}\n  actual:   ${snippet(result.stdout.trim())}`,
        );
        return;
      }
    }
  }

  for (const { file, item: problem } of coding) {
    let ran = false;
    for (const [language, entry] of Object.entries(problem.languages)) {
      const id = language as LanguageId;
      if (!entry.solution) continue;
      if (runtimes[id]) {
        ran = true;
        checkSolution(file, problem, id, entry.solution);
      } else {
        skipped.push(`${file}: ${LANGUAGES[id].label} reference solution`);
      }
    }
    if (!ran) {
      errors.push(`${file}: no reference solution could be run on this machine`);
    }
  }

  return {
    errors,
    skipped,
    counts: { mcq: mcqs.length, coding: coding.length, exams: exams.length, referenceRuns },
  };
}

function checkExams(
  exams: Loaded<Exam>[],
  mcqs: Loaded<Mcq>[],
  coding: Loaded<CodingProblem>[],
  errors: string[],
) {
  const mcqIds = new Set(mcqs.map(({ item }) => item.id));
  const problems = new Map(coding.map(({ item }) => [item.id, item]));

  for (const { file, item: exam } of exams) {
    if (new Set(exam.mcq).size !== exam.mcq.length) {
      errors.push(`${file}: mcq must not list a question twice`);
    }
    for (const id of exam.mcq) {
      if (!mcqIds.has(id)) errors.push(`${file}: mcq lists unknown question "${id}"`);
    }
    const slots = [
      ['shortCoding', exam.shortCoding, 'short'],
      ['longCoding', exam.longCoding, 'long'],
    ] as const;
    for (const [field, id, type] of slots) {
      const problem = problems.get(id);
      if (!problem) errors.push(`${file}: ${field} names unknown problem "${id}"`);
      else if (problem.type !== type) {
        errors.push(`${file}: ${field} names "${id}", which is a ${problem.type} problem`);
      }
    }
  }
}
