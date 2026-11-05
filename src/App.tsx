import { useCallback, useRef, useState } from 'react';
import type { Attempt } from './attempt/attempt.ts';
import { clearHistory, loadHistory } from './attempt/history.ts';
import { loadAttempt, saveAttempt } from './attempt/storage.ts';
import { findExam } from './content/bank.ts';
import { ExamScreen } from './ui/ExamScreen.tsx';
import { Landing } from './ui/Landing.tsx';
import { Readiness } from './ui/Readiness.tsx';
import { Results } from './ui/Results.tsx';

export type UpdateAttempt = (change: (attempt: Attempt) => Attempt) => void;

type Screen = { name: 'home' } | { name: 'progress' } | { name: 'review'; id: string };

export function App() {
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(Date.now()));
  const [saveFailed, setSaveFailed] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
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

  const home = () => setScreen({ name: 'home' });

  if (attempt) {
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
          <Results
            attempt={attempt}
            exam={exam}
            update={update}
            closeLabel="Start a new test"
            onClose={() => {
              replace(null);
              home();
            }}
            onShowProgress={() => setScreen({ name: 'progress' })}
          />
        )}
      </>
    );
  }

  const history = loadHistory();

  if (screen.name === 'review') {
    const entry = history.find((candidate) => candidate.id === screen.id);
    const exam = entry && findExam(entry.examId);
    if (entry?.attempt && exam) {
      return (
        <Results
          attempt={entry.attempt}
          exam={exam}
          closeLabel="Back to progress"
          onClose={() => setScreen({ name: 'progress' })}
        />
      );
    }
  }

  if (screen.name !== 'home') {
    return (
      <Readiness
        entries={history}
        onBack={home}
        onOpen={(id) => setScreen({ name: 'review', id })}
        onClear={() => {
          clearHistory();
          home();
        }}
      />
    );
  }

  return (
    <Landing
      onStart={replace}
      onShowProgress={history.length > 0 ? () => setScreen({ name: 'progress' }) : undefined}
    />
  );
}
