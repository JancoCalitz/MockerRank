import { beforeEach, describe, expect, it } from 'vitest';
import { codingSchema, type Exam } from '../content/schema.ts';
import type { Question } from '../content/bank.ts';
import type { JudgeResult } from '../runner/judge.ts';
import {
  addTimeSpent,
  appendChat,
  applyDeadline,
  assistantMessagesLeft,
  chatFor,
  clearSelection,
  currentCode,
  codingAnswer,
  examSummary,
  finishAttempt,
  formatRemaining,
  isFlagged,
  questionStatus,
  remainingMs,
  selectOption,
  setCode,
  setHiddenTestsShown,
  startAttempt,
  storeJudgeResult,
  toggleFlag,
  updateCoding,
} from './attempt.ts';
import { loadAttempt, saveAttempt } from './storage.ts';

const NOW = 1_000_000;
const MINUTE = 60_000;

const exam: Exam = {
  id: 'mock-1',
  name: 'Mock',
  mcq: [],
  shortCoding: 'a',
  longCoding: 'b',
  durationMinutes: 90,
  proctoring: { requireFullscreen: false, warnAfterViolations: 2 },
  assistant: { maxMessagesPerQuestion: 2 },
  scoring: { mcqWeight: 40, shortWeight: 20, longWeight: 40, multiSelect: 'all-or-nothing' },
};

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
  hiddenTests: [{ input: '', output: '' }],
  languages: {
    python: { starter: 'py starter', solution: 'x' },
    java: { starter: 'java starter' },
  },
  checker: { type: 'exact' },
  editorial: 'e',
});

const mcqQuestion = { kind: 'mcq', id: 'q1', mcq: {} } as Question;
const codingQuestion: Question = { kind: 'coding', id: 'p', problem };

describe('timer', () => {
  it('sets the deadline from the exam duration', () => {
    const attempt = startAttempt(exam, NOW);

    expect(attempt.status).toBe('in_progress');
    expect(remainingMs(attempt, NOW + MINUTE)).toBe(89 * MINUTE);
  });

  it('does not extend the deadline when reloading mid-attempt', () => {
    const attempt = startAttempt(exam, NOW);

    expect(applyDeadline(attempt, NOW + 89 * MINUTE)).toBe(attempt);
    expect(remainingMs(attempt, NOW + 200 * MINUTE)).toBe(0);
  });

  it('expires at the deadline, recording the deadline as the finish time', () => {
    const attempt = startAttempt(exam, NOW);

    const expired = applyDeadline(attempt, NOW + 200 * MINUTE);

    expect(expired.status).toBe('expired');
    expect(expired.finishedAt).toBe(attempt.deadline);
  });

  it('does not turn a submitted attempt into an expired one', () => {
    const submitted = finishAttempt(startAttempt(exam, NOW), 'submitted', NOW + MINUTE);

    expect(applyDeadline(submitted, NOW + 200 * MINUTE).status).toBe('submitted');
  });

  it('formats the time remaining', () => {
    expect(formatRemaining(90 * MINUTE)).toBe('1:30:00');
    expect(formatRemaining(5 * MINUTE + 3000)).toBe('05:03');
    expect(formatRemaining(1)).toBe('00:01');
    expect(formatRemaining(0)).toBe('00:00');
  });
});

describe('multiple choice answers', () => {
  it('replaces the choice on a single-select question', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 1, false);
    attempt = selectOption(attempt, 'q1', 3, false);

    expect(attempt.mcq.q1!.selected).toEqual([3]);
  });

  it('toggles choices on a multi-select question, keeping them in order', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 3, true);
    attempt = selectOption(attempt, 'q1', 0, true);
    expect(attempt.mcq.q1!.selected).toEqual([0, 3]);

    attempt = selectOption(attempt, 'q1', 3, true);
    expect(attempt.mcq.q1!.selected).toEqual([0]);
  });

  it('clears a selection but keeps the flag', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 1, false);
    attempt = toggleFlag(attempt, mcqQuestion);
    attempt = clearSelection(attempt, 'q1');

    expect(attempt.mcq.q1).toEqual({ selected: [], flagged: true });
    expect(questionStatus(attempt, mcqQuestion)).toBe('unanswered');
  });

  it('cannot change after the attempt has finished', () => {
    const finished = finishAttempt(startAttempt(exam, NOW), 'submitted', NOW);

    expect(selectOption(finished, 'q1', 1, false)).toBe(finished);
    expect(setCode(finished, problem, 'python', 'x')).toBe(finished);
    expect(addTimeSpent(finished, 'q1', 1000)).toBe(finished);
  });
});

describe('coding answers', () => {
  it('starts from the starter code', () => {
    const attempt = startAttempt(exam, NOW);

    expect(currentCode(codingAnswer(attempt, problem), problem)).toBe('py starter');
    expect(questionStatus(attempt, codingQuestion)).toBe('unanswered');
  });

  it('keeps separate code for each language', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = setCode(attempt, problem, 'python', 'my python');
    attempt = updateCoding(attempt, problem, { language: 'java' });
    expect(currentCode(codingAnswer(attempt, problem), problem)).toBe('java starter');

    attempt = setCode(attempt, problem, 'java', 'my java');
    attempt = updateCoding(attempt, problem, { language: 'python' });
    expect(currentCode(codingAnswer(attempt, problem), problem)).toBe('my python');
  });

  it('counts as answered only once the code differs from the starter', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = setCode(attempt, problem, 'python', 'py starter');
    expect(questionStatus(attempt, codingQuestion)).toBe('unanswered');

    attempt = setCode(attempt, problem, 'python', 'changed');
    expect(questionStatus(attempt, codingQuestion)).toBe('answered');
  });

  it('shortens long output when storing a result', () => {
    const result: JudgeResult = {
      compiled: true,
      compileOutput: '',
      tests: [
        {
          verdict: 'accepted',
          status: 'ok',
          stdout: 'x'.repeat(10000),
          stderr: '',
          timeMs: 1,
          memoryKb: null,
        },
      ],
    };

    const stored = storeJudgeResult(result, 'python', NOW, 'print(1)');

    expect(stored.tests[0]!.stdout.length).toBeLessThan(5000);
    expect(stored.tests[0]!.stdout).toContain('output shortened');
  });
});

describe('hidden tests', () => {
  it('stays marked as revealed after hiding them again', () => {
    let attempt = startAttempt(exam, NOW);
    expect(attempt.hiddenTestsRevealed).toBe(false);

    attempt = setHiddenTestsShown(attempt, true);
    attempt = setHiddenTestsShown(attempt, false);

    expect(attempt.showHiddenTests).toBe(false);
    expect(attempt.hiddenTestsRevealed).toBe(true);
  });
});

describe('assistant', () => {
  const exchange = (text: string) => [
    { role: 'user' as const, text, at: NOW },
    { role: 'assistant' as const, text: 'hint', at: NOW },
  ];

  it('counts only the candidate’s messages against the cap', () => {
    let attempt = startAttempt(exam, NOW);
    expect(assistantMessagesLeft(attempt, 'p', 2)).toBe(2);

    attempt = appendChat(attempt, 'p', exchange('one'));
    expect(assistantMessagesLeft(attempt, 'p', 2)).toBe(1);

    attempt = appendChat(attempt, 'p', exchange('two'));
    expect(assistantMessagesLeft(attempt, 'p', 2)).toBe(0);
  });

  it('counts each question separately', () => {
    const attempt = appendChat(startAttempt(exam, NOW), 'p', exchange('one'));

    expect(assistantMessagesLeft(attempt, 'other', 2)).toBe(2);
    expect(chatFor(attempt, 'other')).toEqual([]);
  });

  it('gives no messages in strict mode', () => {
    const strict = startAttempt(exam, NOW, { assistantEnabled: false });

    expect(strict.assistantEnabled).toBe(false);
    expect(assistantMessagesLeft(strict, 'p', 2)).toBe(0);
  });

  it('never goes below zero, and allows attempts saved before the assistant existed', () => {
    let attempt = startAttempt(exam, NOW);
    for (const text of ['a', 'b', 'c']) attempt = appendChat(attempt, 'p', exchange(text));
    expect(assistantMessagesLeft(attempt, 'p', 2)).toBe(0);

    const older = { ...startAttempt(exam, NOW) } as Partial<ReturnType<typeof startAttempt>>;
    delete older.chat;
    delete older.assistantEnabled;
    const old = older as ReturnType<typeof startAttempt>;
    expect(chatFor(old, 'p')).toEqual([]);
    expect(assistantMessagesLeft(old, 'p', 2)).toBe(2);
    expect(chatFor(appendChat(old, 'p', exchange('a')), 'p')).toHaveLength(2);
  });

  it('drops a reply that arrives after the attempt has finished', () => {
    const finished = finishAttempt(startAttempt(exam, NOW), 'expired', NOW);

    expect(appendChat(finished, 'p', exchange('late'))).toBe(finished);
  });
});

describe('summary', () => {
  it('counts answered, unanswered, and flagged questions', () => {
    let attempt = startAttempt(exam, NOW);
    attempt = selectOption(attempt, 'q1', 0, false);
    attempt = toggleFlag(attempt, codingQuestion);

    expect(isFlagged(attempt, codingQuestion)).toBe(true);
    expect(examSummary(attempt, [mcqQuestion, codingQuestion])).toEqual({
      total: 2,
      answered: 1,
      unanswered: 1,
      flagged: 1,
    });
  });
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('restores a saved attempt with its answers', () => {
    const attempt = selectOption(startAttempt(exam, NOW), 'q1', 2, false);
    saveAttempt(attempt);

    expect(loadAttempt(NOW + MINUTE)).toEqual(attempt);
  });

  it('expires a saved attempt if the deadline passed while it was closed', () => {
    saveAttempt(startAttempt(exam, NOW));

    expect(loadAttempt(NOW + 200 * MINUTE)!.status).toBe('expired');
  });

  it('ignores corrupt data, older versions, and unknown exams', () => {
    localStorage.setItem('mockerrank.attempt', 'not json');
    expect(loadAttempt(NOW)).toBeNull();

    saveAttempt({ ...startAttempt(exam, NOW), version: 0 as 1 });
    expect(loadAttempt(NOW)).toBeNull();

    saveAttempt({ ...startAttempt(exam, NOW), examId: 'gone' });
    expect(loadAttempt(NOW)).toBeNull();
  });

  it('removes the attempt when saving nothing', () => {
    saveAttempt(startAttempt(exam, NOW));
    saveAttempt(null);

    expect(loadAttempt(NOW)).toBeNull();
  });
});
