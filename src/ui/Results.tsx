import { useEffect, useMemo, useState } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import {
  codingAnswer,
  examSummary,
  formatDuration,
  needsGrading,
  recordFinalSubmission,
  storeJudgeResult,
  type Attempt,
} from '../attempt/attempt.ts';
import { historyEntry, recordInHistory } from '../attempt/history.ts';
import {
  READINESS_TARGET,
  scoreAttempt,
  TOPIC_LABELS,
  type QuestionScore,
} from '../attempt/score.ts';
import { examQuestions } from '../content/bank.ts';
import { LANGUAGES } from '../content/languages.ts';
import type { Exam } from '../content/schema.ts';
import { PercentBars, TargetMeter } from './charts.tsx';
import { Markdown } from './Markdown.tsx';
import { TestResults } from './TestResults.tsx';

function McqReview({ score, attempt }: { score: QuestionScore; attempt: Attempt }) {
  if (score.question.kind !== 'mcq') return null;
  const { mcq } = score.question;
  const selected = attempt.mcq[mcq.id]?.selected ?? [];
  return (
    <div className="mt-3">
      <Markdown>{mcq.stem}</Markdown>
      <ul className="mt-3 space-y-1">
        {mcq.options.map((option, index) => {
          const correct = mcq.correctIndexes.includes(index);
          const chosen = selected.includes(index);
          return (
            <li
              key={option}
              className={`flex justify-between gap-3 rounded border p-2 text-sm ${
                correct ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
              }`}
            >
              <span>{option}</span>
              <span className="shrink-0 text-xs font-medium text-slate-700">
                {[correct && '✓ Correct answer', chosen && 'Your answer']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
      {selected.length === 0 && <p className="mt-2 text-sm text-slate-600">You did not answer.</p>}
      <div className="mt-3 rounded bg-slate-50 p-3">
        <p className="text-sm font-semibold">Explanation</p>
        <Markdown>{mcq.explanation}</Markdown>
      </div>
    </div>
  );
}

function CodingReview({
  score,
  attempt,
  showHidden,
}: {
  score: QuestionScore;
  attempt: Attempt;
  showHidden: boolean;
}) {
  if (score.question.kind !== 'coding') return null;
  const { problem } = score.question;
  const { submission } = codingAnswer(attempt, problem);
  return (
    <div className="mt-3 space-y-3">
      {submission ? (
        <>
          <p className="text-sm text-slate-700">Language: {LANGUAGES[submission.language].label}</p>
          <TestResults
            problem={problem}
            result={submission}
            kind="submission"
            showHidden={showHidden}
          />
          <details>
            <summary className="cursor-pointer text-sm font-medium">Your code</summary>
            <pre className="mt-1 max-h-96 overflow-auto rounded bg-slate-100 p-2 font-mono text-xs">
              {submission.source}
            </pre>
          </details>
        </>
      ) : (
        <p className="text-sm text-slate-600">You did not write any code for this question.</p>
      )}
      <div className="rounded bg-slate-50 p-3">
        <p className="text-sm font-semibold">Editorial</p>
        <Markdown>{problem.editorial}</Markdown>
      </div>
    </div>
  );
}

interface ResultsProps {
  attempt: Attempt;
  exam: Exam;
  // Only the current attempt can be graded. A past attempt is read-only.
  update?: UpdateAttempt;
  onClose: () => void;
  closeLabel: string;
  onShowProgress?: () => void;
}

export function Results({
  attempt,
  exam,
  update,
  onClose,
  closeLabel,
  onShowProgress,
}: ResultsProps) {
  const questions = useMemo(() => examQuestions(exam), [exam]);
  const [gradingError, setGradingError] = useState('');
  const [retries, setRetries] = useState(0);
  const [showHidden, setShowHidden] = useState(true);

  const pending = update
    ? questions.flatMap((question) => {
        if (question.kind !== 'coding') return [];
        const final = needsGrading(attempt, question.problem);
        return final ? [{ problem: question.problem, ...final }] : [];
      })
    : [];
  const next = gradingError ? undefined : pending[0];
  const nextKey = next && `${next.problem.id}/${next.language}/${next.code}/${retries}`;
  const score = useMemo(() => scoreAttempt(attempt, exam), [attempt, exam]);

  // Judges one problem at a time, and the saved attempt moves this along to the next.
  useEffect(() => {
    if (!next || !update) return;
    let cancelled = false;
    (async () => {
      try {
        const { submit } = await import('../runner/judge.ts');
        const result = await submit(next.problem, next.language, next.code);
        if (cancelled) return;
        const stored = storeJudgeResult(result, next.language, Date.now(), next.code);
        update((current) => recordFinalSubmission(current, next.problem, stored));
      } catch (error) {
        if (!cancelled) setGradingError(String((error as Error).message ?? error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // nextKey identifies the work to do; the rest only changes along with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextKey]);

  const grading = pending.length > 0 && !gradingError;
  const gradingDone = pending.length === 0;

  useEffect(() => {
    if (update && gradingDone) recordInHistory(historyEntry(attempt, exam.name, score));
  }, [update, gradingDone, attempt, exam.name, score]);

  // Leaving with ungraded code keeps the score as it stands, so the attempt is not lost.
  const close = () => {
    if (update) recordInHistory(historyEntry(attempt, exam.name, score));
    onClose();
  };

  const summary = examSummary(attempt, questions);
  const percent = Math.round(score.percent);
  const gap = READINESS_TARGET - percent;
  const buttonClass =
    'rounded border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50';

  return (
    <main className="mx-auto max-w-3xl p-8 font-sans text-slate-900">
      <p className="font-semibold text-emerald-700">{exam.name}</p>
      <h1 className="mt-1 text-3xl font-bold">
        {attempt.status === 'expired' ? 'Time is up' : 'Test submitted'}
      </h1>
      <p className="mt-2 text-slate-700">
        You answered {summary.answered} of {summary.total} questions.
        {attempt.hiddenTestsRevealed && ' This attempt is marked as assisted.'}
      </p>

      {grading && (
        <p role="status" className="mt-4 rounded bg-blue-50 p-3 text-sm text-blue-900">
          Judging your final code: {pending.length} {pending.length === 1 ? 'problem' : 'problems'}{' '}
          left. Your score will update when this finishes.
        </p>
      )}
      {gradingError && (
        <div role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">
          <p>Some code could not be judged, so it is not in your score yet: {gradingError}</p>
          <button
            type="button"
            className="mt-2 rounded border border-red-300 px-3 py-1 font-medium"
            onClick={() => {
              setGradingError('');
              setRetries((count) => count + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      <section className="mt-6 rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-600">Total score</h2>
        <p className="text-5xl font-bold tabular-nums">{percent}%</p>
        <p className="mt-1 text-sm text-slate-700">
          {gap <= 0
            ? `✓ At or above the ${READINESS_TARGET}% target.`
            : `${gap} ${gap === 1 ? 'point' : 'points'} below the ${READINESS_TARGET}% target.`}
        </p>
        <div className="mt-6">
          <TargetMeter percent={score.percent} target={READINESS_TARGET} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">By section</h2>
        <div className="mt-2">
          <PercentBars
            label="Score by section"
            rows={score.sections.map((section) => ({
              label: section.label,
              percent: section.percent,
              detail: `${Math.round(section.weightPercent)}% of total`,
            }))}
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">By topic, weakest first</h2>
        <div className="mt-2">
          <PercentBars
            label="Score by topic"
            rows={score.topics.map((topic) => ({
              label: TOPIC_LABELS[topic.topic],
              percent: topic.percent,
            }))}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Review each question</h2>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            onClick={() => setShowHidden((value) => !value)}
          >
            {showHidden ? 'Hide hidden test data' : 'Show hidden test data'}
          </button>
        </div>
        <ol className="mt-2 space-y-2">
          {score.questions.map((item, index) => {
            const title =
              item.question.kind === 'mcq'
                ? TOPIC_LABELS[item.question.mcq.topic]
                : item.question.problem.title;
            return (
              <li key={item.question.id} className="rounded border border-slate-200">
                <details className="p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 text-sm">
                    <span className="font-medium">
                      {index + 1}. {title}
                    </span>
                    <span className="ml-auto text-xs text-slate-600">
                      {formatDuration(item.timeMs)}
                    </span>
                    <span className="w-24 text-right font-semibold">
                      {item.earned === 1
                        ? '✓ Correct'
                        : item.earned === 0
                          ? '✗ 0%'
                          : `${Math.round(item.earned * 100)}%`}
                    </span>
                  </summary>
                  <McqReview score={item} attempt={attempt} />
                  <CodingReview score={item} attempt={attempt} showHidden={showHidden} />
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-8 flex gap-2">
        <button type="button" className={buttonClass} onClick={close}>
          {closeLabel}
        </button>
        {onShowProgress && (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              close();
              onShowProgress();
            }}
          >
            View progress
          </button>
        )}
      </div>
    </main>
  );
}
