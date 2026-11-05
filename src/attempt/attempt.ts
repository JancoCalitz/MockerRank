import type { Question } from '../content/bank.ts';
import type { LanguageId } from '../content/languages.ts';
import type { CodingProblem, Exam } from '../content/schema.ts';
import type { JudgeResult, Verdict } from '../runner/judge.ts';

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired';

export interface McqAnswer {
  selected: number[];
  flagged: boolean;
}

export interface StoredTestResult {
  verdict: Verdict;
  stdout: string;
  stderr: string;
  timeMs: number;
  memoryKb: number | null;
}

export interface StoredJudgeResult {
  language: LanguageId;
  compiled: boolean;
  compileOutput: string;
  tests: StoredTestResult[];
  at: number;
}

export interface CodingAnswer {
  language: LanguageId;
  code: Partial<Record<LanguageId, string>>;
  flagged: boolean;
  customInput: string;
  run?: StoredJudgeResult;
  submission?: StoredJudgeResult;
}

export interface Attempt {
  version: 1;
  id: string;
  examId: string;
  status: AttemptStatus;
  startedAt: number;
  deadline: number;
  finishedAt?: number;
  currentIndex: number;
  mcq: Record<string, McqAnswer>;
  coding: Record<string, CodingAnswer>;
  timeSpentMs: Record<string, number>;
  // Set once hidden tests are shown, so progress towards a target stays honest.
  hiddenTestsRevealed: boolean;
  showHiddenTests: boolean;
}

export type QuestionStatus = 'answered' | 'unanswered';

const MAX_STORED_OUTPUT = 4000;

export function startAttempt(exam: Exam, now: number): Attempt {
  return {
    version: 1,
    id: `${exam.id}-${now}`,
    examId: exam.id,
    status: 'in_progress',
    startedAt: now,
    deadline: now + exam.durationMinutes * 60_000,
    currentIndex: 0,
    mcq: {},
    coding: {},
    timeSpentMs: {},
    hiddenTestsRevealed: false,
    showHiddenTests: false,
  };
}

// The attempt is finished once, and answers cannot change afterwards.
function whileInProgress(attempt: Attempt, change: (attempt: Attempt) => Attempt): Attempt {
  return attempt.status === 'in_progress' ? change(attempt) : attempt;
}

export function finishAttempt(
  attempt: Attempt,
  status: 'submitted' | 'expired',
  now: number,
): Attempt {
  return whileInProgress(attempt, (current) => ({ ...current, status, finishedAt: now }));
}

// Called on load and on every timer tick, so closing the tab cannot extend the time.
export function applyDeadline(attempt: Attempt, now: number): Attempt {
  return now >= attempt.deadline ? finishAttempt(attempt, 'expired', attempt.deadline) : attempt;
}

export function remainingMs(attempt: Attempt, now: number): number {
  return Math.max(0, attempt.deadline - now);
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function goToQuestion(attempt: Attempt, index: number): Attempt {
  return { ...attempt, currentIndex: index };
}

export function addTimeSpent(attempt: Attempt, questionId: string, ms: number): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    timeSpentMs: {
      ...current.timeSpentMs,
      [questionId]: (current.timeSpentMs[questionId] ?? 0) + ms,
    },
  }));
}

function mcqAnswer(attempt: Attempt, id: string): McqAnswer {
  return attempt.mcq[id] ?? { selected: [], flagged: false };
}

export function selectOption(
  attempt: Attempt,
  id: string,
  option: number,
  multiSelect: boolean,
): Attempt {
  return whileInProgress(attempt, (current) => {
    const answer = mcqAnswer(current, id);
    const selected = !multiSelect
      ? [option]
      : answer.selected.includes(option)
        ? answer.selected.filter((value) => value !== option)
        : [...answer.selected, option].sort((a, b) => a - b);
    return { ...current, mcq: { ...current.mcq, [id]: { ...answer, selected } } };
  });
}

export function clearSelection(attempt: Attempt, id: string): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    mcq: { ...current.mcq, [id]: { ...mcqAnswer(current, id), selected: [] } },
  }));
}

export function firstLanguage(problem: CodingProblem): LanguageId {
  return Object.keys(problem.languages)[0] as LanguageId;
}

export function codingAnswer(attempt: Attempt, problem: CodingProblem): CodingAnswer {
  return (
    attempt.coding[problem.id] ?? {
      language: firstLanguage(problem),
      code: {},
      flagged: false,
      customInput: '',
    }
  );
}

export function currentCode(answer: CodingAnswer, problem: CodingProblem): string {
  return answer.code[answer.language] ?? problem.languages[answer.language]!.starter;
}

export function updateCoding(
  attempt: Attempt,
  problem: CodingProblem,
  change: Partial<CodingAnswer>,
): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    coding: {
      ...current.coding,
      [problem.id]: { ...codingAnswer(current, problem), ...change },
    },
  }));
}

export function setCode(
  attempt: Attempt,
  problem: CodingProblem,
  language: LanguageId,
  code: string,
): Attempt {
  const answer = codingAnswer(attempt, problem);
  return updateCoding(attempt, problem, { code: { ...answer.code, [language]: code } });
}

export function toggleFlag(attempt: Attempt, question: Question): Attempt {
  return whileInProgress(attempt, (current) => {
    if (question.kind === 'mcq') {
      const answer = mcqAnswer(current, question.id);
      return {
        ...current,
        mcq: { ...current.mcq, [question.id]: { ...answer, flagged: !answer.flagged } },
      };
    }
    const flagged = !codingAnswer(current, question.problem).flagged;
    return updateCoding(current, question.problem, { flagged });
  });
}

export function setHiddenTestsShown(attempt: Attempt, show: boolean): Attempt {
  return whileInProgress(attempt, (current) => ({
    ...current,
    showHiddenTests: show,
    hiddenTestsRevealed: current.hiddenTestsRevealed || show,
  }));
}

// Local storage is limited, so a program that prints a lot only keeps the start of its output.
function truncate(text: string): string {
  return text.length > MAX_STORED_OUTPUT
    ? `${text.slice(0, MAX_STORED_OUTPUT)}\n... (output shortened)`
    : text;
}

export function storeJudgeResult(
  result: JudgeResult,
  language: LanguageId,
  now: number,
): StoredJudgeResult {
  return {
    language,
    compiled: result.compiled,
    compileOutput: truncate(result.compileOutput),
    tests: result.tests.map((test) => ({
      verdict: test.verdict,
      stdout: truncate(test.stdout),
      stderr: truncate(test.stderr),
      timeMs: test.timeMs,
      memoryKb: test.memoryKb,
    })),
    at: now,
  };
}

export function isFlagged(attempt: Attempt, question: Question): boolean {
  return question.kind === 'mcq'
    ? mcqAnswer(attempt, question.id).flagged
    : codingAnswer(attempt, question.problem).flagged;
}

export function questionStatus(attempt: Attempt, question: Question): QuestionStatus {
  if (question.kind === 'mcq') {
    return mcqAnswer(attempt, question.id).selected.length > 0 ? 'answered' : 'unanswered';
  }
  const { problem } = question;
  const answer = codingAnswer(attempt, problem);
  const edited = Object.entries(answer.code).some(
    ([language, code]) => code !== problem.languages[language as LanguageId]?.starter,
  );
  return edited || answer.submission ? 'answered' : 'unanswered';
}

export function examSummary(attempt: Attempt, questions: Question[]) {
  const unanswered = questions.filter((q) => questionStatus(attempt, q) === 'unanswered').length;
  const flagged = questions.filter((q) => isFlagged(attempt, q)).length;
  return { total: questions.length, answered: questions.length - unanswered, unanswered, flagged };
}
