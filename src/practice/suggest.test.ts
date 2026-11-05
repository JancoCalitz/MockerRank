import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../attempt/history.ts';
import type { CodingProblem } from '../content/schema.ts';
import { recommendProblems, weakestTopics } from './suggest.ts';

function problem(id: string, difficulty: string, topics: string[]) {
  return { id, difficulty, topics } as unknown as CodingProblem;
}

function entry(assisted: boolean, topics: [string, number][]) {
  return {
    assisted,
    topics: topics.map(([topic, percent]) => ({ topic, percent, questions: 1 })),
  } as unknown as HistoryEntry;
}

describe('weakestTopics', () => {
  it('orders topics from weakest, leaving out those already at full marks', () => {
    const entries = [
      entry(false, [
        ['git', 100],
        ['sql', 20],
        ['hashing', 50],
      ]),
    ];
    expect(weakestTopics(entries, 5)).toEqual(['sql', 'hashing']);
  });

  it('ignores assisted attempts', () => {
    expect(weakestTopics([entry(true, [['sql', 0]])], 5)).toEqual([]);
  });
});

describe('recommendProblems', () => {
  const problems = [
    problem('hard-sql', 'hard', ['sql']),
    problem('easy-sql', 'easy', ['sql']),
    problem('other', 'easy', ['git']),
    problem('missed', 'hard', ['git']),
    problem('done', 'easy', ['sql']),
  ];
  const ids = (list: CodingProblem[]) => list.map((item) => item.id);

  it('puts missed problems first, then weak topics from easiest', () => {
    const result = recommendProblems(
      problems,
      { solved: new Set(['done']), missed: ['missed'], weakTopics: ['sql'] },
      10,
    );
    expect(ids(result)).toEqual(['missed', 'easy-sql', 'hard-sql']);
  });

  it('leaves out solved problems, even ones missed earlier', () => {
    const result = recommendProblems(
      problems,
      { solved: new Set(['missed']), missed: ['missed'], weakTopics: [] },
      10,
    );
    expect(result).toEqual([]);
  });

  it('respects the limit', () => {
    const result = recommendProblems(
      problems,
      { solved: new Set(), missed: [], weakTopics: ['sql'] },
      1,
    );
    expect(ids(result)).toEqual(['easy-sql']);
  });
});
