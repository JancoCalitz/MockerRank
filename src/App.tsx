import { useCallback, useRef, useState } from 'react';
import { findExam } from './content/bank.ts';
import type { Attempt } from './attempt/attempt.ts';
import { loadAttempt, saveAttempt } from './attempt/storage.ts';
import { ExamScreen } from './ui/ExamScreen.tsx';
import { Finished } from './ui/Finished.tsx';
import { Landing } from './ui/Landing.tsx';

export type UpdateAttempt = (change: (attempt: Attempt) => Attempt) => void;

export function App() {
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(Date.now()));
  const [saveFailed, setSaveFailed] = useState(false);
  const latest = useRef(attempt);

  const replace = useCallback((next: Attempt | null) => {
    latest.current = next;
    setAttempt(next);
    setSaveFailed(!saveAttempt(next));
  }, []);

  // Every change is saved immediately, so nothing is lost if the tab closes.
  const update: UpdateAttempt = useCallback(
    (change) => {
      if (latest.current) replace(change(latest.current));
    },
    [replace],
  );

  if (!attempt) return <Landing onStart={replace} />;

  const exam = findExam(attempt.examId)!;
  return (
    <>
      {saveFailed && (
        <p role="alert" className="bg-red-700 px-4 py-2 text-sm text-white">
          Your browser could not save your latest answers, because its storage may be full. Do not
          close this tab.
        </p>
      )}
      {attempt.status === 'in_progress' ? (
        <ExamScreen attempt={attempt} exam={exam} update={update} />
      ) : (
        <Finished attempt={attempt} exam={exam} onDiscard={() => replace(null)} />
      )}
    </>
  );
}
