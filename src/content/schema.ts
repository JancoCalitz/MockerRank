import { z } from 'zod';
import { LANGUAGE_IDS } from './languages.ts';

export const MCQ_COUNT = 18;
export const OPTION_COUNT = 4;

// Function-style harnesses contain this marker where the candidate's code goes.
export const USER_CODE_MARKER = '{{USER_CODE}}';

export const TOPICS = [
  'arrays-strings',
  'hashing',
  'sorting-searching',
  'stacks-queues',
  'linked-lists',
  'trees-graphs',
  'recursion-dp',
  'big-o',
  'oop-design',
  'sql',
  'debugging-code-reading',
  'language-trivia',
  'rest-http',
  'git',
  'testing',
] as const;

const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase words separated by hyphens');
const difficultySchema = z.enum(['easy', 'medium', 'hard']);
const text = z.string().trim().min(1, 'must not be empty');

export const mcqSchema = z
  .strictObject({
    id: idSchema,
    topic: z.enum(TOPICS),
    difficulty: difficultySchema,
    stem: text,
    options: z.array(text).length(OPTION_COUNT, `must have exactly ${OPTION_COUNT} options`),
    multiSelect: z.boolean().default(false),
    correctIndexes: z
      .array(
        z
          .int()
          .min(0)
          .max(OPTION_COUNT - 1),
      )
      .min(1, 'must name at least one correct option'),
    explanation: text,
    tags: z.array(text).default([]),
  })
  .superRefine((mcq, ctx) => {
    if (new Set(mcq.options).size !== mcq.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'must not repeat an option' });
    }
    if (new Set(mcq.correctIndexes).size !== mcq.correctIndexes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctIndexes'],
        message: 'must not repeat an index',
      });
    }
    if (!mcq.multiSelect && mcq.correctIndexes.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['correctIndexes'],
        message: 'must name exactly one option unless multiSelect is true',
      });
    }
  });

const checkerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('exact') }),
  z.strictObject({ type: z.literal('token') }),
  z.strictObject({ type: z.literal('float-tolerance'), tolerance: z.number().positive() }),
  // JavaScript function body. Receives input, expected, and actual; returns a boolean.
  z.strictObject({ type: z.literal('custom'), script: text }),
]);

const testSchema = z.strictObject({ input: z.string(), output: z.string() });
const hiddenTestSchema = testSchema.extend({ weight: z.number().positive().default(1) });

const languageEntrySchema = z.strictObject({
  starter: text,
  harness: text.optional(),
  solution: text.optional(),
});

export const codingSchema = z
  .strictObject({
    id: idSchema,
    title: text,
    type: z.enum(['short', 'long']),
    style: z.enum(['stdin', 'function']),
    difficulty: difficultySchema,
    statement: text,
    inputFormat: text,
    outputFormat: text,
    constraints: text,
    sampleTests: z.array(testSchema).min(1, 'must have at least one sample test'),
    hiddenTests: z.array(hiddenTestSchema).min(1, 'must have at least one hidden test'),
    // Optional overrides. Without them, each language uses its default limits.
    timeLimitMs: z.int().positive().optional(),
    memoryLimitMb: z.int().positive().optional(),
    languages: z.partialRecord(z.enum(LANGUAGE_IDS), languageEntrySchema),
    checker: checkerSchema,
    editorial: text,
    tags: z.array(text).default([]),
    // Counted in topic-level performance alongside multiple choice questions.
    topics: z.array(z.enum(TOPICS)).default([]),
  })
  .superRefine((problem, ctx) => {
    const entries = Object.entries(problem.languages);
    if (entries.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['languages'], message: 'must allow a language' });
    }
    if (!entries.some(([, entry]) => entry.solution)) {
      ctx.addIssue({
        code: 'custom',
        path: ['languages'],
        message: 'must include a reference solution in at least one language',
      });
    }
    for (const [language, entry] of entries) {
      const path = ['languages', language, 'harness'];
      if (problem.style === 'function' && !entry.harness?.includes(USER_CODE_MARKER)) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `must contain ${USER_CODE_MARKER} for a function-style problem`,
        });
      }
      if (problem.style === 'stdin' && entry.harness) {
        ctx.addIssue({ code: 'custom', path, message: 'is only for function-style problems' });
      }
    }
    if (problem.checker.type === 'custom') {
      try {
        new Function('input', 'expected', 'actual', problem.checker.script);
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          path: ['checker', 'script'],
          message: `is not valid JavaScript: ${(error as Error).message}`,
        });
      }
    }
  });

export const examSchema = z.strictObject({
  id: idSchema,
  name: text,
  mcq: z.array(idSchema).length(MCQ_COUNT, `must list exactly ${MCQ_COUNT} questions`),
  shortCoding: idSchema,
  longCoding: idSchema,
  durationMinutes: z.int().positive().default(90),
  assistant: z.strictObject({ maxMessagesPerQuestion: z.int().min(0).default(10) }).prefault({}),
  scoring: z
    .strictObject({
      // Relative weights of each section in the total score.
      mcqWeight: z.number().min(0).default(40),
      shortWeight: z.number().min(0).default(20),
      longWeight: z.number().min(0).default(40),
      // partial: each correct choice earns a share, and each wrong choice takes one away.
      multiSelect: z.enum(['all-or-nothing', 'partial']).default('all-or-nothing'),
    })
    .prefault({})
    .refine(
      (scoring) => scoring.mcqWeight + scoring.shortWeight + scoring.longWeight > 0,
      'must give at least one section a weight',
    ),
});

export type Mcq = z.infer<typeof mcqSchema>;
export type CodingProblem = z.infer<typeof codingSchema>;
export type Exam = z.infer<typeof examSchema>;
export type Checker = CodingProblem['checker'];
