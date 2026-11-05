import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import { codingAnswer, startAttempt, type Attempt } from '../attempt/attempt.ts';
import { scoreCoding, TOPIC_LABELS } from '../attempt/score.ts';
import { EXAMS, PROBLEMS } from '../content/bank.ts';
import type { CodingProblem } from '../content/schema.ts';
import { Markdown } from './Markdown.tsx';

const CodingView = lazy(() => import('./CodingView.tsx'));

const GYM_KEY = 'mockerrank.gym';
const GYM_ASSISTANT_MESSAGES = 50;
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

// The coding view works on an attempt, so the gym keeps one long-lived attempt of its own. It is
// separate from exams, has no timer, and never reaches exam history.
function loadGym(): Attempt {
  try {
    const saved = JSON.parse(localStorage.getItem(GYM_KEY) ?? 'null') as Attempt | null;
    if (saved?.version === 1) return saved;
  } catch {
    // Fall through to a new one.
  }
  const now = Date.now();
  return { ...startAttempt(EXAMS[0]!, now), examId: 'gym', deadline: now + TEN_YEARS_MS };
}

function ProblemList({ gym, onOpen }: { gym: Attempt; onOpen: (id: string) => void }) {
  const groups: [string, CodingProblem[]][] = [
    ['Short problems', PROBLEMS.filter((problem) => problem.type === 'short')],
    ['Long problems', PROBLEMS.filter((problem) => problem.type === 'long')],
  ];
  return (
    <main className="mx-auto max-w-3xl px-8 pb-8 font-sans text-slate-900">
      <h1 className="mt-4 text-3xl font-bold">Coding gym</h1>
      <p className="mt-2 text-slate-700">
        One problem at a time, with no timer. You can use hints, reveal the tests, and read the
        editorial. Your code here stays in this browser, and does not affect your exam history.
      </p>
      {groups.map(([title, problems]) => (
        <section key={title} className="mt-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <ul className="mt-2 space-y-1">
            {problems.map((problem) => {
              const solved = scoreCoding(problem, codingAnswer(gym, problem).submission) === 1;
              return (
                <li key={problem.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                    onClick={() => onOpen(problem.id)}
                  >
                    <span className="font-medium">{problem.title}</span>
                    <span className="text-xs text-slate-600">
                      {problem.difficulty}
                      {problem.topics.map((topic) => `, ${TOPIC_LABELS[topic]}`).join('')}
                    </span>
                    {solved && <span className="ml-auto text-xs font-semibold">✓ Solved</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}

export function GymScreen({ nav }: { nav: ReactNode }) {
  const [gym, setGym] = useState(loadGym);
  const [problemId, setProblemId] = useState<string | null>(null);
  const [showEditorial, setShowEditorial] = useState(false);
  const latest = useRef(gym);

  const update: UpdateAttempt = useCallback((change) => {
    latest.current = change(latest.current);
    setGym(latest.current);
    try {
      localStorage.setItem(GYM_KEY, JSON.stringify(latest.current));
    } catch {
      // Practice work simply is not saved if the browser's storage is full.
    }
  }, []);

  const problem = PROBLEMS.find((candidate) => candidate.id === problemId);
  if (!problem) {
    return (
      <>
        {nav}
        <ProblemList gym={gym} onOpen={setProblemId} />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col font-sans text-slate-900">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setProblemId(null);
            setShowEditorial(false);
          }}
        >
          All problems
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 text-sm"
          onClick={() => setShowEditorial((value) => !value)}
        >
          {showEditorial ? 'Hide editorial' : 'Show editorial'}
        </button>
      </header>
      {showEditorial && (
        <aside className="max-h-48 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3">
          <Markdown>{problem.editorial}</Markdown>
        </aside>
      )}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<p className="p-6 text-slate-600">Loading the editor…</p>}>
          <CodingView
            key={problem.id}
            attempt={gym}
            problem={problem}
            maxAssistantMessages={GYM_ASSISTANT_MESSAGES}
            practice
            update={update}
          />
        </Suspense>
      </div>
    </div>
  );
}
