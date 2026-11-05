import { useCallback, useRef, useState } from 'react';
import type { Attempt } from './attempt/attempt.ts';
import { clearHistory, loadHistory } from './attempt/history.ts';
import { loadAttempt, saveAttempt } from './attempt/storage.ts';
import { examFor, examProblems } from './content/bank.ts';
import { saveDrill } from './practice/drill.ts';
import { CodeGate } from './ui/CodeGate.tsx';
import { DataScreen } from './ui/DataScreen.tsx';
import { DrillScreen } from './ui/DrillScreen.tsx';
import { ExamScreen } from './ui/ExamScreen.tsx';
import { GymScreen } from './ui/GymScreen.tsx';
import { Landing } from './ui/Landing.tsx';
import { ModeNav, type Mode } from './ui/ModeNav.tsx';
import { Readiness } from './ui/Readiness.tsx';
import { Results } from './ui/Results.tsx';

export type UpdateAttempt = (change: (attempt: Attempt) => Attempt) => void;

type Screen =
  | { name: 'home' }
  | { name: 'progress' }
  | { name: 'review'; id: string }
  | { name: Exclude<Mode, 'exam'> };

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
    const exam = examFor(attempt)!;
    return (
      <>
        {saveFailed && (
          <p role="alert" className="bg-red-700 px-4 py-2 text-sm text-white">
            Your browser could not save your latest answers, because its storage may be full. Do not
            close this tab.
          </p>
        )}
        <CodeGate problems={examProblems(exam)}>
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
        </CodeGate>
      </>
    );
  }

  const history = loadHistory();

  if (screen.name === 'review') {
    const entry = history.find((candidate) => candidate.id === screen.id);
    const exam = entry?.attempt ? examFor(entry.attempt) : undefined;
    if (entry?.attempt && exam) {
      return (
        <CodeGate problems={examProblems(exam)}>
          <Results
            attempt={entry.attempt}
            exam={exam}
            closeLabel="Back to progress"
            onClose={() => setScreen({ name: 'progress' })}
          />
        </CodeGate>
      );
    }
  }

  if (screen.name === 'progress' || screen.name === 'review') {
    return (
      <Readiness
        entries={history}
        onBack={home}
        onOpen={(id) => setScreen({ name: 'review', id })}
        onDrill={(drill) => {
          saveDrill(drill);
          setScreen({ name: 'drill' });
        }}
        onOpenGym={() => setScreen({ name: 'gym' })}
        onClear={() => {
          clearHistory();
          home();
        }}
      />
    );
  }

  const mode: Mode = screen.name === 'home' ? 'exam' : screen.name;
  const changeMode = (next: Mode) => setScreen(next === 'exam' ? { name: 'home' } : { name: next });
  const nav = <ModeNav current={mode} onChange={changeMode} />;

  // The gym's problem view fills the screen, so it only shows these links on its list.
  if (mode === 'gym') return <GymScreen nav={nav} />;

  return (
    <>
      {nav}
      {mode === 'drill' && <DrillScreen />}
      {mode === 'data' && <DataScreen />}
      {mode === 'exam' && (
        <Landing
          onStart={replace}
          onShowProgress={history.length > 0 ? () => setScreen({ name: 'progress' }) : undefined}
        />
      )}
    </>
  );
}
