import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
import { McqView } from './McqView.tsx';

// The editor and the runners are large, so they load when a coding question first opens.
const CodingView = lazy(() => import('./CodingView.tsx'));

const WARNING_MS = 5 * 60_000;
const TICK_MS = 1000;

interface ExamScreenProps {
  attempt: Attempt;
  exam: Exam;
  update: UpdateAttempt;
}

export function ExamScreen({ attempt, exam, update }: ExamScreenProps) {
  const questions = useMemo(() => examQuestions(exam), [exam]);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const question = questions[attempt.currentIndex]!;

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

  const remaining = remainingMs(attempt, now);
  const summary = examSummary(attempt, questions);
  const last = questions.length - 1;
  const flagged = isFlagged(attempt, question);

  return (
    <div className="flex h-screen flex-col font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <p className="font-semibold">{exam.name}</p>
          <div className="flex items-center gap-4">
            <p
              role="timer"
              aria-label="Time remaining"
              className={`font-mono text-lg font-semibold ${remaining < WARNING_MS ? 'text-red-700' : ''}`}
            >
              {formatRemaining(remaining)}
            </p>
            <button
              type="button"
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
              onClick={() => setConfirming(true)}
            >
              Submit test
            </button>
          </div>
        </div>
        <nav aria-label="Questions" className="mt-2 flex flex-wrap gap-1">
          {questions.map((candidate, index) => {
            const status = questionStatus(attempt, candidate);
            const isFlaggedTile = isFlagged(attempt, candidate);
            return (
              <button
                key={candidate.id}
                type="button"
                aria-label={`Question ${index + 1}, ${status}${isFlaggedTile ? ', flagged' : ''}`}
                aria-current={index === attempt.currentIndex ? 'true' : undefined}
                className={`relative h-7 w-7 rounded text-xs font-medium ${
                  status === 'answered'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-800'
                } ${index === attempt.currentIndex ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                onClick={() => update((current) => goToQuestion(current, index))}
              >
                {index + 1}
                {isFlaggedTile && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

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

      <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          disabled={attempt.currentIndex === 0}
          onClick={() => update((current) => goToQuestion(current, current.currentIndex - 1))}
        >
          Previous
        </button>
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-600">
            Question {attempt.currentIndex + 1} of {questions.length}
          </p>
          <button
            type="button"
            aria-pressed={flagged}
            className={`rounded border px-3 py-1 text-sm ${
              flagged ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-300'
            }`}
            onClick={() => update((current) => toggleFlag(current, question))}
          >
            {flagged ? 'Flagged for review' : 'Flag for review'}
          </button>
        </div>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm disabled:opacity-40"
          disabled={attempt.currentIndex === last}
          onClick={() => update((current) => goToQuestion(current, current.currentIndex + 1))}
        >
          Next
        </button>
      </footer>

      {confirming && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="max-w-md rounded-lg bg-white p-6 shadow-lg"
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
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                onClick={() => setConfirming(false)}
              >
                Keep working
              </button>
              <button
                type="button"
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
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
