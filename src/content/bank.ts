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

export const MCQS: Mcq[] = inFolder('mcq').flatMap((file) => z.array(mcqSchema).parse(file));
export const PROBLEMS: CodingProblem[] = inFolder('coding').map((file) => codingSchema.parse(file));

export const EXAMS: Exam[] = inFolder('exams').map((file) => examSchema.parse(file));

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

export function findExam(id: string): Exam | undefined {
  return EXAMS.find((exam) => exam.id === id);
}

// A random exam is not in the bank, so its attempt carries its own copy.
export function examFor(attempt: { examId: string; generatedExam?: Exam }): Exam | undefined {
  return attempt.generatedExam ?? findExam(attempt.examId);
}
