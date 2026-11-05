import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMS, examQuestions } from '../content/bank.ts';
import { codingSchema, examSchema, mcqSchema, type Exam } from '../content/schema.ts';
import {
  codingAnswer,
  formatDuration,
  needsGrading,
  recordFinalSubmission,
  selectOption,
  setCode,
  startAttempt,
  updateCoding,
  type StoredJudgeResult,
  type StoredTestResult,
} from './attempt.ts';
import { clearHistory, historyEntry, loadHistory, recordInHistory } from './history.ts';
import { combineTopics, scoreAttempt, scoreCoding, scoreMcq, type AttemptScore } from './score.ts';

const single = mcqSchema.parse({
  id: 'single',
  topic: 'git',
  difficulty: 'easy',
  stem: 's',
  options: ['a', 'b', 'c', 'd'],
  correctIndexes: [1],
  explanation: 'e',
});
const multi = mcqSchema.parse({
  ...single,
  id: 'multi',
  multiSelect: true,
  correctIndexes: [0, 2],
});

const problem = codingSchema.parse({
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
  hiddenTests: [
    { input: '', output: '', weight: 1 },
    { input: '', output: '', weight: 2 },
  ],
  languages: { python: { starter: 'starter', solution: 'x' } },
  checker: { type: 'exact' },
  editorial: 'e',
});

const test = (verdict: StoredTestResult['verdict']): StoredTestResult => ({
  verdict,
  stdout: '',
  stderr: '',
  timeMs: 1,
  memoryKb: null,
});

const result = (verdicts: StoredTestResult['verdict'][], source = 'code'): StoredJudgeResult => ({
  language: 'python',
  compiled: true,
  compileOutput: '',
  tests: verdicts.map(test),
  at: 1,
  source,
});

describe('scoreMcq', () => {
  it('gives nothing for no answer', () => {
    expect(scoreMcq(single, [], 'all-or-nothing')).toBe(0);
    expect(scoreMcq(multi, [], 'partial')).toBe(0);
  });

  it('marks a single answer right or wrong', () => {
    expect(scoreMcq(single, [1], 'all-or-nothing')).toBe(1);
    expect(scoreMcq(single, [0], 'all-or-nothing')).toBe(0);
    expect(scoreMcq(single, [1], 'partial')).toBe(1);
  });

  it('needs the exact set for all-or-nothing multi-select', () => {
    expect(scoreMcq(multi, [0, 2], 'all-or-nothing')).toBe(1);
    expect(scoreMcq(multi, [0], 'all-or-nothing')).toBe(0);
    expect(scoreMcq(multi, [0, 1, 2], 'all-or-nothing')).toBe(0);
  });

  it('gives a share per correct choice for partial multi-select', () => {
    expect(scoreMcq(multi, [0, 2], 'partial')).toBe(1);
    expect(scoreMcq(multi, [0], 'partial')).toBe(0.5);
  });

  it('takes a share away for each wrong choice, but never goes below zero', () => {
    expect(scoreMcq(multi, [0, 2, 1], 'partial')).toBe(0.5);
    expect(scoreMcq(multi, [0, 1], 'partial')).toBe(0);
    expect(scoreMcq(multi, [1, 3], 'partial')).toBe(0);
  });
});

describe('scoreCoding', () => {
  it('gives nothing with no submission, or when it does not compile', () => {
    expect(scoreCoding(problem, undefined)).toBe(0);
    expect(scoreCoding(problem, { ...result([]), compiled: false })).toBe(0);
  });

  it('gives nothing when no tests pass', () => {
    expect(scoreCoding(problem, result(['wrong-answer', 'time-limit', 'runtime-error']))).toBe(0);
  });

  it('gives full marks when every test passes', () => {
    expect(scoreCoding(problem, result(['accepted', 'accepted', 'accepted']))).toBe(1);
  });

  it('weights tests: the sample counts 1 and hidden tests use their weight', () => {
    expect(scoreCoding(problem, result(['accepted', 'wrong-answer', 'wrong-answer']))).toBe(0.25);
    expect(scoreCoding(problem, result(['wrong-answer', 'wrong-answer', 'accepted']))).toBe(0.5);
  });

  it('counts tests with no result as failed', () => {
    expect(scoreCoding(problem, result(['accepted']))).toBe(0.25);
  });
});

describe('scoreAttempt', () => {
  const exam = EXAMS[0]!;
  const questions = examQuestions(exam);

  function perfectAttempt(target: Exam) {
    let attempt = startAttempt(target, 0);
    for (const question of questions) {
      if (question.kind === 'mcq') {
        for (const index of question.mcq.correctIndexes) {
          attempt = selectOption(attempt, question.id, index, question.mcq.multiSelect);
        }
      } else {
        const tests = question.problem.sampleTests.length + question.problem.hiddenTests.length;
        const submission = result(Array(tests).fill('accepted'));
        attempt = updateCoding(attempt, question.problem, { submission });
      }
    }
    return attempt;
  }

  it('gives zero for an untouched attempt', () => {
    const score = scoreAttempt(startAttempt(exam, 0), exam);

    expect(score.percent).toBe(0);
    expect(score.sections.map((section) => section.percent)).toEqual([0, 0, 0]);
  });

  it('gives 100% for a perfect attempt', () => {
    const score = scoreAttempt(perfectAttempt(exam), exam);

    expect(score.percent).toBeCloseTo(100);
    expect(score.topics.every((topic) => topic.percent === 100)).toBe(true);
  });

  it('uses the default weights of 40, 20, and 40', () => {
    let attempt = startAttempt(exam, 0);
    for (const question of questions) {
      if (question.kind === 'coding' && question.problem.type === 'short') {
        const tests = question.problem.sampleTests.length + question.problem.hiddenTests.length;
        attempt = updateCoding(attempt, question.problem, {
          submission: result(Array(tests).fill('accepted')),
        });
      }
    }

    const score = scoreAttempt(attempt, exam);

    expect(score.sections.map((section) => section.weightPercent)).toEqual([40, 20, 40]);
    expect(score.percent).toBeCloseTo(20);
  });

  it('applies an exam’s own weights', () => {
    const weighted = examSchema.parse({
      ...exam,
      scoring: { mcqWeight: 1, shortWeight: 1, longWeight: 2 },
    });
    expect(scoreAttempt(perfectAttempt(weighted), weighted).sections[2]!.weightPercent).toBe(50);
  });

  it('rejects an exam where nothing has any weight', () => {
    const scoring = { mcqWeight: 0, shortWeight: 0, longWeight: 0 };
    expect(examSchema.safeParse({ ...exam, scoring }).success).toBe(false);
  });

  it('reports topics, weakest first, including coding problems', () => {
    let attempt = startAttempt(exam, 0);
    const first = questions[0]!;
    if (first.kind === 'mcq') {
      attempt = selectOption(attempt, first.id, first.mcq.correctIndexes[0]!, false);
    }

    const { topics } = scoreAttempt(attempt, exam);

    expect(topics.at(-1)!.percent).toBe(100);
    expect(topics[0]!.percent).toBe(0);
    expect(topics.find((topic) => topic.topic === 'hashing')!.questions).toBe(2);
  });
});

describe('grading code when an attempt finishes', () => {
  const exam = EXAMS[0]!;

  it('skips code that was never changed', () => {
    expect(needsGrading(startAttempt(exam, 0), problem)).toBeNull();
    expect(
      needsGrading(setCode(startAttempt(exam, 0), problem, 'python', 'starter'), problem),
    ).toBeNull();
  });

  it('judges changed code that was never submitted', () => {
    const attempt = setCode(startAttempt(exam, 0), problem, 'python', 'mine');

    expect(needsGrading(attempt, problem)).toEqual({ language: 'python', code: 'mine' });
  });

  it('skips code that matches its submission, but judges later edits', () => {
    let attempt = setCode(startAttempt(exam, 0), problem, 'python', 'mine');
    attempt = updateCoding(attempt, problem, { submission: result(['accepted'], 'mine') });
    expect(needsGrading(attempt, problem)).toBeNull();

    attempt = setCode(attempt, problem, 'python', 'edited');
    expect(needsGrading(attempt, problem)).toEqual({ language: 'python', code: 'edited' });
  });

  it('records the result even though the attempt has finished', () => {
    const finished = { ...startAttempt(exam, 0), status: 'expired' as const };

    const graded = recordFinalSubmission(finished, problem, result(['accepted']));

    expect(codingAnswer(graded, problem).submission?.tests).toHaveLength(1);
  });
});

describe('combineTopics', () => {
  it('weights each topic by its number of questions', () => {
    const combined = combineTopics([
      [{ topic: 'git', percent: 100, questions: 1 }],
      [
        { topic: 'git', percent: 0, questions: 3 },
        { topic: 'sql', percent: 50, questions: 2 },
      ],
    ]);

    expect(combined).toEqual([
      { topic: 'git', percent: 25, questions: 4 },
      { topic: 'sql', percent: 50, questions: 2 },
    ]);
  });
});

describe('formatDuration', () => {
  it('shows seconds, then minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(125_000)).toBe('2m 05s');
  });
});

describe('history', () => {
  const exam = EXAMS[0]!;
  const score: AttemptScore = { percent: 50, sections: [], topics: [], questions: [] };
  const entry = (at: number) =>
    historyEntry({ ...startAttempt(exam, at), finishedAt: at }, exam.name, score);

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps attempts oldest first, and replaces one recorded twice', () => {
    recordInHistory(entry(200));
    recordInHistory(entry(100));
    recordInHistory({ ...entry(200), percent: 90 });

    expect(loadHistory().map((item) => [item.finishedAt, item.percent])).toEqual([
      [100, 50],
      [200, 90],
    ]);
  });

  it('marks an attempt with revealed hidden tests as assisted', () => {
    const attempt = { ...startAttempt(exam, 1), hiddenTestsRevealed: true };

    expect(historyEntry(attempt, exam.name, score).assisted).toBe(true);
  });

  it('drops the oldest attempt detail, but keeps scores, when storage is full', () => {
    recordInHistory(entry(100));
    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      // Fails until the older attempt's detail has been removed.
      if (value.split('"attempt":{').length > 2) throw new Error('quota');
      realSetItem.call(this, key, value);
    });

    expect(recordInHistory(entry(200))).toBe(true);

    const [older, newer] = loadHistory();
    expect(older!.attempt).toBeNull();
    expect(older!.percent).toBe(50);
    expect(newer!.attempt).not.toBeNull();
  });

  it('survives corrupt data, and can be cleared', () => {
    localStorage.setItem('mockerrank.history', 'not json');
    expect(loadHistory()).toEqual([]);

    recordInHistory(entry(100));
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
