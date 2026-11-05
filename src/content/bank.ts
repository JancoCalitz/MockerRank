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

// Vite bundles the question bank at build time. npm run content:validate checks it thoroughly;
// parsing here applies defaults and stops a bad file from reaching the exam screen.
const files = import.meta.glob('/content/**/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function inFolder(folder: string): unknown[] {
  return Object.entries(files)
    .filter(([path]) => path.startsWith(`/content/${folder}/`))
    .map(([, text]) => parse(text) as unknown);
}

const mcqs = inFolder('mcq').flatMap((file) => z.array(mcqSchema).parse(file));
const problems = inFolder('coding').map((file) => codingSchema.parse(file));

export const EXAMS: Exam[] = inFolder('exams').map((file) => examSchema.parse(file));

const mcqById = new Map(mcqs.map((mcq) => [mcq.id, mcq]));
const problemById = new Map(problems.map((problem) => [problem.id, problem]));

export type Question =
  { kind: 'mcq'; id: string; mcq: Mcq } | { kind: 'coding'; id: string; problem: CodingProblem };

// Multiple choice first, then the short problem, then the long one.
export function examQuestions(exam: Exam): Question[] {
  const mcqQuestions = exam.mcq.map((id): Question => ({ kind: 'mcq', id, mcq: mcqById.get(id)! }));
  const codingQuestions = [exam.shortCoding, exam.longCoding].map((id): Question => ({
    kind: 'coding',
    id,
    problem: problemById.get(id)!,
  }));
  return [...mcqQuestions, ...codingQuestions];
}

export function findExam(id: string): Exam | undefined {
  return EXAMS.find((exam) => exam.id === id);
}
