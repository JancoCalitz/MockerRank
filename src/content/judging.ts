import type { Checker, CodingProblem } from './schema.ts';
import { USER_CODE_MARKER } from './schema.ts';
import { LANGUAGES, type LanguageId } from './languages.ts';

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

function tokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

// Line endings, trailing spaces, and trailing blank lines are not meaningful output.
function normalizeLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

function tokensMatch(expected: string, actual: string, same: (e: string, a: string) => boolean) {
  const e = tokens(expected);
  const a = tokens(actual);
  return e.length === a.length && e.every((token, i) => same(token, a[i]!));
}

export function outputMatches(
  checker: Checker,
  { input, expected, actual }: { input: string; expected: string; actual: string },
): boolean {
  switch (checker.type) {
    case 'exact':
      return normalizeLines(expected) === normalizeLines(actual);
    case 'token':
      return tokensMatch(expected, actual, (e, a) => e === a);
    case 'float-tolerance':
      return tokensMatch(expected, actual, (e, a) =>
        NUMBER.test(e) && NUMBER.test(a)
          ? Math.abs(Number(e) - Number(a)) <= checker.tolerance
          : e === a,
      );
    case 'custom':
      return (
        new Function('input', 'expected', 'actual', checker.script)(input, expected, actual) ===
        true
      );
  }
}

// Builds the program to run: the code itself, or the code placed inside the harness.
export function assembleSource(problem: CodingProblem, language: LanguageId, code: string): string {
  if (problem.style === 'stdin') return code;
  // split and join, because replace() would treat $ in the candidate's code as a pattern.
  return problem.languages[language]!.harness!.split(USER_CODE_MARKER).join(code);
}

export function limitsFor(problem: CodingProblem, language: LanguageId) {
  return {
    timeLimitMs: problem.timeLimitMs ?? LANGUAGES[language].timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb ?? LANGUAGES[language].memoryLimitMb,
  };
}
