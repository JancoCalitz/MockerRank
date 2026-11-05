import { examSummary, type Attempt } from '../attempt/attempt.ts';
import { examQuestions } from '../content/bank.ts';
import type { Exam } from '../content/schema.ts';

interface FinishedProps {
  attempt: Attempt;
  exam: Exam;
  onDiscard: () => void;
}

export function Finished({ attempt, exam, onDiscard }: FinishedProps) {
  const summary = examSummary(attempt, examQuestions(exam));

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans text-slate-900">
      <p className="font-semibold text-emerald-700">{exam.name}</p>
      <h1 className="mt-1 text-3xl font-bold">
        {attempt.status === 'expired' ? 'Time is up' : 'Test submitted'}
      </h1>
      <p className="mt-4">
        You answered {summary.answered} of {summary.total} questions.
        {attempt.hiddenTestsRevealed && ' This attempt is marked as assisted.'}
      </p>
      <p className="mt-2 text-sm text-slate-600">Your answers are saved in this browser.</p>
      <button
        type="button"
        className="mt-6 rounded border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
        onClick={onDiscard}
      >
        Discard and start again
      </button>
    </main>
  );
}
