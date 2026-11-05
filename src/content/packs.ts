import { parse } from 'yaml';
import { z } from 'zod';
import {
  codingSchema,
  examSchema,
  mcqSchema,
  type CodingProblem,
  type Exam,
  type Mcq,
} from './schema.ts';

const PACKS_KEY = 'mockerrank.packs';
export const MAX_PACK_CHARACTERS = 2_000_000;

export const packSchema = z.strictObject({
  format: z.literal('mockerrank-pack'),
  name: z.string().trim().min(1),
  mcqs: z.array(mcqSchema).default([]),
  problems: z.array(codingSchema).default([]),
  exams: z.array(examSchema).default([]),
});

export type Pack = z.infer<typeof packSchema>;

export interface KnownQuestions {
  mcqs: readonly Mcq[];
  problems: readonly CodingProblem[];
  exams: readonly Exam[];
}

export type PackResult =
  { ok: true; pack: Pack; skipped: number } | { ok: false; errors: string[] };

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (text, part) =>
      typeof part === 'number' ? `${text}[${part}]` : `${text}${text ? '.' : ''}${String(part)}`,
    '',
  );
}

// Checks a pack from a file, which could come from anyone, and works out what is new in it.
// Items identical to ones already here are skipped, so re-importing a pack is harmless.
export function parsePack(text: string, known: KnownQuestions): PackResult {
  if (text.length > MAX_PACK_CHARACTERS) {
    return { ok: false, errors: ['This file is too large. The limit is about 2 MB.'] };
  }
  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [`This file is not valid JSON or YAML: ${(error as Error).message}`],
    };
  }
  const parsed = packSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${formatPath(issue.path) || 'The file'}: ${issue.message}`),
    };
  }
  const pack = parsed.data;
  const errors: string[] = [];
  let skipped = 0;

  function fresh<T extends { id: string }>(items: T[], existing: readonly T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) {
        errors.push(`The id "${item.id}" appears twice in this pack.`);
        return false;
      }
      seen.add(item.id);
      const match = existing.find((other) => other.id === item.id);
      if (!match) return true;
      if (same(match, item)) {
        skipped++;
      } else {
        errors.push(`The id "${item.id}" is already used by a different question or exam.`);
      }
      return false;
    });
  }

  const mcqs = fresh(pack.mcqs, known.mcqs);
  const problems = fresh(pack.problems, known.problems);
  const exams = fresh(pack.exams, known.exams);

  const ids = new Set([
    ...known.mcqs.map((mcq) => mcq.id),
    ...known.problems.map((problem) => problem.id),
    ...known.exams.map((exam) => exam.id),
  ]);
  for (const item of [...mcqs, ...problems, ...exams]) {
    if (ids.has(item.id))
      errors.push(`The id "${item.id}" is already used by another type of item.`);
    ids.add(item.id);
  }

  // A custom checker is JavaScript that runs in the page, which also holds the AI key. That is
  // fine for this project's own questions, but not for a file from somewhere else.
  for (const problem of problems) {
    if (problem.checker.type === 'custom') {
      errors.push(`"${problem.id}" uses a custom checker, which imported packs cannot use.`);
    }
  }

  // Test files ship with the app, so a pack's problems have to carry their tests inside it.
  for (const problem of problems) {
    if (problem.hiddenTests.some((test) => 'file' in test)) {
      errors.push(`"${problem.id}" refers to a test file, which imported packs cannot use.`);
    }
  }

  const allMcqs = new Set([...known.mcqs, ...mcqs].map((mcq) => mcq.id));
  const allProblems = new Map([...known.problems, ...problems].map((p) => [p.id, p]));
  for (const exam of exams) {
    for (const id of exam.mcq) {
      if (!allMcqs.has(id)) errors.push(`Exam "${exam.id}" lists unknown question "${id}".`);
    }
    if (new Set(exam.mcq).size !== exam.mcq.length) {
      errors.push(`Exam "${exam.id}" lists a question twice.`);
    }
    for (const [id, type] of [
      [exam.shortCoding, 'short'],
      [exam.longCoding, 'long'],
    ] as const) {
      const problem = allProblems.get(id);
      if (!problem) errors.push(`Exam "${exam.id}" names unknown problem "${id}".`);
      else if (problem.type !== type) {
        errors.push(`Exam "${exam.id}" needs a ${type} problem, but "${id}" is ${problem.type}.`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, pack: { ...pack, mcqs, problems, exams }, skipped };
}

export function loadPacks(): Pack[] {
  try {
    const saved = JSON.parse(localStorage.getItem(PACKS_KEY) ?? '[]') as unknown[];
    // One damaged pack should not stop the app from starting.
    return saved.flatMap((item) => {
      const parsed = packSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

// Returns false if the browser refused, such as when its storage is full.
export function savePacks(packs: Pack[]): boolean {
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
    return true;
  } catch {
    return false;
  }
}

export function exportPack(name: string, known: KnownQuestions): string {
  return JSON.stringify(
    {
      format: 'mockerrank-pack',
      name,
      mcqs: known.mcqs,
      problems: known.problems,
      exams: known.exams,
    },
    null,
    1,
  );
}
