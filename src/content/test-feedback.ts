import type { LanguageId } from './languages.ts';
import { LANGUAGES } from './languages.ts';
import type { CodingProblem } from './schema.ts';
import { limitsFor } from './judging.ts';

// Past this share of the limit, a passing program deserves a warning.
const CLOSE_TO_LIMIT = 0.7;

export function timeLimitFor(problem: CodingProblem, language: LanguageId): number {
  return limitsFor(problem, language).timeLimitMs * LANGUAGES[language].timeMultiplier;
}

export function formatLimit(limitMs: number): string {
  return `${Number((limitMs / 1000).toFixed(1))} s`;
}

export interface FeedbackInput {
  verdict: 'accepted' | 'wrong-answer' | 'time-limit' | 'memory-limit' | 'runtime-error';
  timeMs: number;
  limitMs: number;
  isLarge: boolean;
}

// Says what a result suggests doing next, especially whether the problem is speed or correctness.
export function testFeedback({ verdict, timeMs, limitMs, isLarge }: FeedbackInput): string | null {
  const share = Math.round((timeMs / limitMs) * 100);
  switch (verdict) {
    case 'time-limit':
      return isLarge
        ? `Too slow on the largest input, with a limit of ${formatLimit(limitMs)}. Your answers may be right, but this approach probably needs a lower time complexity.`
        : `This did not finish within ${formatLimit(limitMs)}, even on a small input, so check for an endless loop.`;
    case 'wrong-answer':
      return isLarge
        ? `Fast enough, at ${share}% of the time limit, but the answer is wrong. Check what only happens at this size, such as a total too big for a 32-bit integer.`
        : null;
    case 'memory-limit':
      return 'This used too much memory. Check for data you could avoid storing, or a structure that keeps growing.';
    case 'runtime-error':
      return isLarge
        ? 'This crashed on the largest input. Check for very deep recursion, or for arrays that are too small.'
        : null;
    case 'accepted':
      return timeMs >= limitMs * CLOSE_TO_LIMIT
        ? `Passed, but close to the limit, at ${share}% of the ${formatLimit(limitMs)} allowed. A slower computer might not finish in time.`
        : null;
  }
}
