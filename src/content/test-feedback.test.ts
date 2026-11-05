// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatLimit, testFeedback } from './test-feedback.ts';

const base = { timeMs: 100, limitMs: 10_000, isLarge: false };

describe('testFeedback', () => {
  it('says nothing about an ordinary pass', () => {
    expect(testFeedback({ ...base, verdict: 'accepted' })).toBeNull();
  });

  it('warns about a pass that came close to the limit', () => {
    const message = testFeedback({ ...base, verdict: 'accepted', timeMs: 8000 });
    expect(message).toContain('80%');
  });

  it('points to complexity when a large test is too slow', () => {
    const message = testFeedback({ ...base, verdict: 'time-limit', isLarge: true });
    expect(message).toContain('time complexity');
    expect(message).toContain('10 s');
  });

  it('points to an endless loop when a small test is too slow', () => {
    expect(testFeedback({ ...base, verdict: 'time-limit' })).toContain('endless loop');
  });

  it('separates a wrong answer on a large test from a speed problem', () => {
    const message = testFeedback({ ...base, verdict: 'wrong-answer', isLarge: true, timeMs: 500 });
    expect(message).toContain('Fast enough');
    expect(message).toContain('5%');
  });

  it('leaves small wrong answers to the visible output', () => {
    expect(testFeedback({ ...base, verdict: 'wrong-answer' })).toBeNull();
  });

  it('suggests causes for memory and large crashes', () => {
    expect(testFeedback({ ...base, verdict: 'memory-limit' })).toContain('memory');
    expect(testFeedback({ ...base, verdict: 'runtime-error', isLarge: true })).toContain(
      'recursion',
    );
  });
});

describe('formatLimit', () => {
  it('drops needless decimals', () => {
    expect(formatLimit(5000)).toBe('5 s');
    expect(formatLimit(2500)).toBe('2.5 s');
  });
});
