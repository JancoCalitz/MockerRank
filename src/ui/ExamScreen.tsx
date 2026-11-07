import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import {
  addTimeSpent,
  applyDeadline,
  examSummary,
  finishAttempt,
  formatRemaining,
  goToQuestion,
  isFlagged,
  questionStatus,
  remainingMs,
  toggleFlag,
  type Attempt,
} from '../attempt/attempt.ts';
import { examQuestions } from '../content/bank.ts';
import type { Exam } from '../content/schema.ts';
import { violationCount } from '../attempt/integrity.ts';
import { McqView } from './McqView.tsx';
import { useCalm } from '../themes/store.ts';
import { ThemeMenu } from '../themes/ThemeMenu.tsx';
import { isShortcut } from './keys.ts';
import { enterFullscreen, useIntegrityTracking } from './useIntegrityTracking.ts';

// The editor and the runners are large, so they load when a coding question first opens.
const CodingView = lazy(() => import('./CodingView.tsx'));

const WARNING_MS = 5 * 60_000;
const TICK_MS = 1000;
// Moments to warn about time running out, and how long each warning stays up.
const WARNING_MINUTES = [1, 5, 15];
const WARNING_SHOWN_MS = 10_000;

// The minutes left to warn about now, if the time has just passed one of the warning points.
// Worked out from the time left alone, so a reload never repeats an old warning.
function timeWarning(remaining: number): number | null {
  const minutes = WARNING_MINUTES.find((point) => remaining <= point * 60_000);
  if (minutes === undefined || remaining <= 0) return null;
  return remaining > minutes * 60_000 - WARNING_SHOWN_MS ? minutes : null;
}

const NAV_GROUPS = [
  ['mcq', 'Multiple choice'],
  ['coding', 'Coding'],
] as const;

type TileState = 'answered' | 'seen' | 'unseen';

const LEGEND: [TileState, string][] = [
  ['answered', 'Answered'],
  ['seen', 'Seen, not answered'],
  ['unseen', 'Not seen'],
];

function tileClass(state: TileState): string {
  if (state === 'answered') return 'ui-tile-done bg-emerald-600 text-white';
  if (state === 'seen') return 'ui-tile-seen border border-slate-400 bg-white text-slate-800';
  return 'bg-slate-200 text-slate-800';
}

function FlagDot() {
  return (
    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />
  );
}

const SHORTCUTS: [string, string][] = [
  ['1–4 or A–D', 'Choose an answer'],
  ['← and →', 'Previous and next question'],
  ['F', 'Flag or unflag the question'],
  ['Ctrl+Enter', 'Run your code'],
  ['Ctrl+Shift+Enter', 'Submit your code'],
  ['?', 'Show these shortcuts'],
];

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="ui-card mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <h2 id="shortcuts-title" className="text-lg font-semibold">
          Keyboard shortcuts
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded border border-slate-300 px-1.5 font-mono text-xs">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-slate-700">{action}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Single keys do nothing while you type in the editor or a text box.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            ref={close}
            type="button"
            className="ui-btn rounded border border-slate-300 px-3 py-1.5 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExamScreenProps {
  attempt: Attempt;
  exam: Exam;
  update: UpdateAttempt;
}

export function ExamScreen({ attempt, exam, update }: ExamScreenProps) {
  const questions = useMemo(() => examQuestions(exam), [exam]);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigator = useRef<HTMLElement>(null);

  // Keeps the current question's tile in view when the tiles scroll sideways on a phone.
  useEffect(() => {
    navigator.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [attempt.currentIndex]);
  const question = questions[attempt.currentIndex]!;
  const fullscreen = useIntegrityTracking(update);
  const violations = violationCount(attempt);
  const warnAt = exam.proctoring.warnAfterViolations;
  useCalm();

  // This runs for the whole attempt, so moving between questions cannot delay the timer.
  useEffect(() => {
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      update((current) =>
        applyDeadline(addTimeSpent(current, questions[current.currentIndex]!.id, TICK_MS), time),
      );
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [update, questions]);

  // Arrows move between questions, F flags, and ? lists the shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      const move = (step: number) =>
        update((current) => {
          const next = current.currentIndex + step;
          return next < 0 || next >= questions.length ? current : goToQuestion(current, next);
        });
      if (event.key === 'ArrowLeft') move(-1);
      else if (event.key === 'ArrowRight') move(1);
      else if (event.key === 'f' || event.key === 'F') {
        update((current) => toggleFlag(current, questions[current.currentIndex]!));
      } else if (event.key === '?') setShowShortcuts(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [update, questions]);

  const remaining = remainingMs(attempt, now);
  const warning = timeWarning(remaining);
  const summary = examSummary(attempt, questions);
  const last = questions.length - 1;
  const flagged = isFlagged(attempt, question);

  return (
    // dvh: the height left between a phone browser's address bar and toolbar.
    <div className="flex h-dvh flex-col font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <p className="min-w-0 truncate font-semibold">{exam.name}</p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <ThemeMenu />
            <p
              role="timer"
              aria-label="Time remaining"
              className={`font-mono text-lg font-semibold ${remaining < WARNING_MS ? 'text-red-700' : ''} ${warning ? 'motion-safe:animate-pulse' : ''}`}
            >
              {formatRemaining(remaining)}
            </p>
            <button
              type="button"
              className="ui-btn ui-btn-primary rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
              onClick={() => setConfirming(true)}
            >
              Submit test
            </button>
          </div>
        </div>
        {/* On a phone the tiles make one row that scrolls sideways. */}
        <nav
          ref={navigator}
          aria-label="Questions"
          className="mt-1 flex items-center gap-x-4 gap-y-1 overflow-x-auto pt-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        >
          {NAV_GROUPS.map(([kind, label]) => (
            <div key={kind} className="flex shrink-0 items-center gap-1 sm:shrink sm:flex-wrap">
              <span className="mr-1 text-xs text-slate-500">{label}</span>
              {questions.map((candidate, index) => {
                if (candidate.kind !== kind) return null;
                const status = questionStatus(attempt, candidate);
                // Time is only counted on the question being shown, so any means it was opened.
                const seen =
                  status === 'unanswered' && (attempt.timeSpentMs[candidate.id] ?? 0) > 0;
                const isFlaggedTile = isFlagged(attempt, candidate);
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-label={`Question ${index + 1}, ${status}${seen ? ', seen' : ''}${isFlaggedTile ? ', flagged' : ''}`}
                    aria-current={index === attempt.currentIndex ? 'true' : undefined}
                    className={`ui-tile relative h-7 w-7 rounded text-xs font-medium ${tileClass(
                      status === 'answered' ? 'answered' : seen ? 'seen' : 'unseen',
                    )} ${index === attempt.currentIndex ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                    onClick={() => update((current) => goToQuestion(current, index))}
                  >
                    {index + 1}
                    {isFlaggedTile && <FlagDot />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <ul
          aria-label="Key"
          className="mt-1.5 hidden flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 sm:flex"
        >
          {LEGEND.map(([state, label]) => (
            <li key={state} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`ui-tile inline-block h-3 w-3 rounded ${tileClass(state)}`}
              />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full border border-white bg-amber-500"
            />
            Flagged
          </li>
        </ul>
      </header>

      <div aria-live="assertive">
        {warning !== null && (
          <p className="bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-800">
            {warning === 1 ? '1 minute' : `${warning} minutes`} left. The test submits itself when
            time is up.
          </p>
        )}
      </div>

      {attempt.requireFullscreen && !fullscreen && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-1.5 text-sm text-amber-950"
        >
          <span>This test should be taken in full screen.</span>
          <button
            type="button"
            className="ui-btn rounded border border-amber-700 px-2 py-0.5 font-medium"
            onClick={enterFullscreen}
          >
            Return to full screen
          </button>
        </div>
      )}
      {violations >= warnAt && (
        <p role="alert" className="bg-amber-100 px-4 py-1.5 text-sm text-amber-950">
          You have left full screen or the test {violations} times. A real assessment may flag this.
          It appears in your report.
        </p>
      )}

      <div className="min-h-0 flex-1">
        {question.kind === 'mcq' ? (
          <McqView key={question.id} attempt={attempt} mcq={question.mcq} update={update} />
        ) : (
          <Suspense fallback={<p className="p-6 text-slate-600">Loading the editor…</p>}>
            <CodingView
              key={question.id}
              attempt={attempt}
              problem={question.problem}
              maxAssistantMessages={exam.assistant.maxMessagesPerQuestion}
              update={update}
            />
          </Suspense>
        )}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 sm:px-4">
        <button
          type="button"
          className="ui-btn rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          disabled={attempt.currentIndex === 0}
          onClick={() => update((current) => goToQuestion(current, current.currentIndex - 1))}
        >
          Previous
        </button>
        <div className="flex items-center gap-2 sm:gap-4">
          <p className="text-sm whitespace-nowrap text-slate-600">
            <span className="sm:hidden">
              {attempt.currentIndex + 1} / {questions.length}
            </span>
            <span className="hidden sm:inline">
              Question {attempt.currentIndex + 1} of {questions.length}
            </span>
          </p>
          <button
            type="button"
            aria-pressed={flagged}
            aria-label={flagged ? 'Flagged for review' : 'Flag for review'}
            className={`rounded border px-3 py-1 text-sm ${
              flagged ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300'
            }`}
            onClick={() => update((current) => toggleFlag(current, question))}
          >
            <span className="sm:hidden">{flagged ? 'Flagged' : 'Flag'}</span>
            <span className="hidden sm:inline">
              {flagged ? 'Flagged for review' : 'Flag for review'}
            </span>
          </button>
          <button
            type="button"
            aria-keyshortcuts="?"
            className="hidden text-sm text-slate-600 underline sm:inline"
            onClick={() => setShowShortcuts(true)}
          >
            Shortcuts
          </button>
        </div>
        <button
          type="button"
          className="ui-btn rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          disabled={attempt.currentIndex === last}
          onClick={() => update((current) => goToQuestion(current, current.currentIndex + 1))}
        >
          Next
        </button>
      </footer>

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {confirming && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="ui-card mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg"
          >
            <h2 id="submit-title" className="text-lg font-semibold">
              Submit your test?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              You have {summary.unanswered} unanswered and {summary.flagged} flagged{' '}
              {summary.flagged === 1 ? 'question' : 'questions'}. You cannot change your answers
              after submitting.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="ui-btn rounded border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => setConfirming(false)}
              >
                Keep working
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
                onClick={() => update((current) => finishAttempt(current, 'submitted', Date.now()))}
              >
                Submit final answers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
