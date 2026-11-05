import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadMissed,
  mergeMissed,
  missedIds,
  recordAttempt,
  recordQuestionResult,
} from './missed.ts';

beforeEach(() => localStorage.clear());

describe('missed questions', () => {
  it('remembers a wrong answer until it is answered correctly', () => {
    recordQuestionResult('q1', false, 1);
    expect(Object.keys(loadMissed().questions)).toEqual(['q1']);

    recordQuestionResult('q1', true, 2);
    expect(loadMissed().questions).toEqual({});
  });

  it('records an attempt only once, so a refresh cannot bring back what was since fixed', () => {
    const results = [{ id: 'q1', kind: 'mcq' as const, correct: false }];
    recordAttempt('attempt-1', results, 1);
    recordQuestionResult('q1', true, 2);

    recordAttempt('attempt-1', results, 3);

    expect(loadMissed().questions).toEqual({});
  });

  it('separates questions from coding problems', () => {
    recordAttempt(
      'attempt-1',
      [
        { id: 'q1', kind: 'mcq', correct: false },
        { id: 'p1', kind: 'coding', correct: false },
        { id: 'q2', kind: 'mcq', correct: true },
      ],
      1,
    );

    expect(loadMissed().questions).toEqual({ q1: 1 });
    expect(loadMissed().problems).toEqual({ p1: 1 });
  });

  it('lists the most recent first, and skips what has left the bank', () => {
    const items = { old: 1, recent: 5, gone: 9 };
    expect(missedIds(items, new Set(['old', 'recent']))).toEqual(['recent', 'old']);
  });

  it('survives damaged storage', () => {
    localStorage.setItem('mockerrank.missed', '{not json');
    expect(loadMissed().questions).toEqual({});
  });

  it('merges a backup, keeping the later date', () => {
    recordQuestionResult('q1', false, 5);
    mergeMissed({ questions: { q1: 2, q2: 3 }, problems: { p1: 4 }, attempts: ['a'] });

    expect(loadMissed()).toEqual({
      questions: { q1: 5, q2: 3 },
      problems: { p1: 4 },
      attempts: ['a'],
    });
  });
});
