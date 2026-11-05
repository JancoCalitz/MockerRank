import {
  codeLoaders,
  exams as builtInExams,
  mcqs as builtInMcqs,
  problems as builtInProblems,
} from 'virtual:question-bank';
import type { CodingProblem, Exam, Mcq } from './schema.ts';
import { loadPacks, type Pack } from './packs.ts';

// The build checks the question bank, and turns it into JavaScript. See scripts/content-plugin.ts.

export const BUILT_IN = { mcqs: builtInMcqs.length, problems: builtInProblems.length };

// Packs were checked when imported, against the bank as it was then, so this checks ids again
// in case the app has since gained a question with the same id.
const packs = loadPacks();
function withPacks<T extends { id: string }>(builtIn: T[], fromPack: (pack: Pack) => T[]): T[] {
  const items = [...builtIn];
  for (const item of packs.flatMap(fromPack)) {
    if (!items.some((existing) => existing.id === item.id)) items.push(item);
  }
  return items;
}

export const MCQS: Mcq[] = withPacks(builtInMcqs, (pack) => pack.mcqs);
export const PROBLEMS: CodingProblem[] = withPacks(builtInProblems, (pack) => pack.problems);

export const EXAMS: Exam[] = withPacks(builtInExams, (pack) => pack.exams);

const mcqById = new Map(MCQS.map((mcq) => [mcq.id, mcq]));
const problemById = new Map(PROBLEMS.map((problem) => [problem.id, problem]));

export type Question =
  { kind: 'mcq'; id: string; mcq: Mcq } | { kind: 'coding'; id: string; problem: CodingProblem };

// Multiple choice first, then the short problem, then the long one. A question that has since
// left the bank is skipped, so an old attempt can still be opened.
export function examQuestions(exam: Exam): Question[] {
  const mcqQuestions = exam.mcq.flatMap((id): Question[] => {
    const mcq = mcqById.get(id);
    return mcq ? [{ kind: 'mcq', id, mcq }] : [];
  });
  const codingQuestions = [exam.shortCoding, exam.longCoding].flatMap((id): Question[] => {
    const problem = problemById.get(id);
    return problem ? [{ kind: 'coding', id, problem }] : [];
  });
  return [...mcqQuestions, ...codingQuestions];
}

export function problemCodeLoaded(problem: CodingProblem): boolean {
  return Object.keys(problem.languages).length > 0;
}

// A problem's starters, harnesses, and solutions load when it is first needed. A problem from a
// pack already has them. Everything that reads problem.languages runs after this.
export async function loadProblemCode(problem: CodingProblem): Promise<void> {
  if (problemCodeLoaded(problem)) return;
  const loaded = await codeLoaders[problem.id]?.();
  if (loaded) problem.languages = loaded.default;
}

export function examProblems(exam: Exam): CodingProblem[] {
  return [exam.shortCoding, exam.longCoding].flatMap((id) => {
    const problem = problemById.get(id);
    return problem ? [problem] : [];
  });
}

export async function loadAllProblemCode(): Promise<void> {
  await Promise.all(PROBLEMS.map(loadProblemCode));
}

export function findExam(id: string): Exam | undefined {
  return EXAMS.find((exam) => exam.id === id);
}

// A random exam is not in the bank, so its attempt carries its own copy.
export function examFor(attempt: { examId: string; generatedExam?: Exam }): Exam | undefined {
  return attempt.generatedExam ?? findExam(attempt.examId);
}
