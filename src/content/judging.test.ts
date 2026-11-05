import { describe, expect, it } from 'vitest';
import { assembleSource, limitsFor, outputMatches } from './judging.ts';
import { codingSchema, type Checker } from './schema.ts';

const matches = (checker: Checker, expected: string, actual: string) =>
  outputMatches(checker, { input: '', expected, actual });

describe('outputMatches', () => {
  it('exact ignores line endings and trailing whitespace only', () => {
    const exact: Checker = { type: 'exact' };
    expect(matches(exact, 'a b\nc\n', 'a b  \r\nc\r\n\r\n')).toBe(true);
    expect(matches(exact, 'a b', 'a  b')).toBe(false);
    expect(matches(exact, 'a\nb', 'a b')).toBe(false);
  });

  it('token ignores all whitespace differences but not content', () => {
    const token: Checker = { type: 'token' };
    expect(matches(token, 'a b\nc', '  a\nb   c\n')).toBe(true);
    expect(matches(token, 'a b', 'a b c')).toBe(false);
    expect(matches(token, '1', '1.0')).toBe(false);
  });

  it('float-tolerance compares numbers within the tolerance and text exactly', () => {
    const float: Checker = { type: 'float-tolerance', tolerance: 0.01 };
    expect(matches(float, '1.00 ok', '1.005 ok')).toBe(true);
    expect(matches(float, '1.00', '1.02')).toBe(false);
    expect(matches(float, '1.00 ok', '1.00 no')).toBe(false);
    expect(matches(float, '1.00', '')).toBe(false);
    expect(matches(float, '1.00', 'NaN')).toBe(false);
  });

  it('custom runs the script and requires a true result', () => {
    const script = 'return input === "x" && Number(actual) > Number(expected);';
    const custom: Checker = { type: 'custom', script };
    expect(outputMatches(custom, { input: 'x', expected: '1', actual: '2' })).toBe(true);
    expect(outputMatches(custom, { input: 'y', expected: '1', actual: '2' })).toBe(false);
    const truthy: Checker = { type: 'custom', script: 'return 1;' };
    expect(matches(truthy, '', '')).toBe(false);
  });
});

function problem(overrides: object) {
  return codingSchema.parse({
    id: 'p',
    title: 'P',
    type: 'short',
    style: 'stdin',
    difficulty: 'easy',
    statement: 's',
    inputFormat: 'i',
    outputFormat: 'o',
    constraints: 'c',
    sampleTests: [{ input: '', output: '' }],
    hiddenTests: [{ input: '', output: '' }],
    languages: { python: { starter: 's', solution: 'x' } },
    checker: { type: 'exact' },
    editorial: 'e',
    ...overrides,
  });
}

describe('assembleSource', () => {
  it('returns the code unchanged for a stdin problem', () => {
    expect(assembleSource(problem({}), 'python', 'print(1)')).toBe('print(1)');
  });

  it('places code in the harness without treating $ as a pattern', () => {
    const fn = problem({
      style: 'function',
      languages: {
        javascript: { starter: 's', harness: 'A\n{{USER_CODE}}\nB', solution: 'x' },
      },
    });
    expect(assembleSource(fn, 'javascript', "'$&$1'")).toBe("A\n'$&$1'\nB");
  });
});

describe('limitsFor', () => {
  it('uses language defaults unless the problem overrides them', () => {
    expect(limitsFor(problem({}), 'python')).toEqual({ timeLimitMs: 10000, memoryLimitMb: 512 });
    expect(limitsFor(problem({ timeLimitMs: 500 }), 'python').timeLimitMs).toBe(500);
  });
});
