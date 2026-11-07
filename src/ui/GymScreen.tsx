import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import { startAttempt, type Attempt } from '../attempt/attempt.ts';
import { loadHistory } from '../attempt/history.ts';
import { scoreCoding, TOPIC_LABELS } from '../attempt/score.ts';
import { EXAMS, PROBLEMS } from '../content/bank.ts';
import type { CodingProblem } from '../content/schema.ts';
import { loadMissed, missedIds } from '../practice/missed.ts';
import { recommendProblems, weakestTopics } from '../practice/suggest.ts';
import { CodeGate } from './CodeGate.tsx';
import { Markdown } from './Markdown.tsx';
import { Calm } from '../themes/store.ts';
import { ThemeMenu } from '../themes/ThemeMenu.tsx';

const CodingView = lazy(() => import('./CodingView.tsx'));

const GYM_KEY = 'mockerrank.gym';
const GYM_ASSISTANT_MESSAGES = 50;
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const RECOMMENDED_PROBLEMS = 5;
const WEAK_TOPICS = 3;

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
  const isSolved = (problem: CodingProblem) =>
    scoreCoding(problem, gym.coding[problem.id]?.submission) === 1;
  const recommended = recommendProblems(
    PROBLEMS.filter((problem) => !problem.debug),
    {
      solved: new Set(PROBLEMS.filter(isSolved).map((problem) => problem.id)),
      missed: missedIds(loadMissed().problems, new Set(PROBLEMS.map((problem) => problem.id))),
      weakTopics: weakestTopics(loadHistory(), WEAK_TOPICS),
    },
    RECOMMENDED_PROBLEMS,
  );
  const others = PROBLEMS.filter((problem) => !recommended.includes(problem));
  const groups: [string, CodingProblem[]][] = [
    ['Recommended for you', recommended],
    ['Short problems', others.filter((problem) => problem.type === 'short' && !problem.debug)],
    ['Long problems', others.filter((problem) => problem.type === 'long' && !problem.debug)],
    ['Fix the code', others.filter((problem) => problem.debug)],
  ].filter((group): group is [string, CodingProblem[]] => group[1]!.length > 0);

  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [topic, setTopic] = useState('');
  const [hideSolved, setHideSolved] = useState(false);
  const topics = [...new Set(PROBLEMS.flatMap((problem) => problem.topics))];
  const matches = (problem: CodingProblem) =>
    problem.title.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!difficulty || problem.difficulty === difficulty) &&
    (!topic || problem.topics.includes(topic as CodingProblem['topics'][number])) &&
    !(hideSolved && isSolved(problem));
  const shown = groups
    .map(([title, problems]): [string, CodingProblem[], number] => [
      title,
      problems.filter(matches),
      problems.filter(isSolved).length,
    ])
    .filter(([, problems]) => problems.length > 0);
  const total = groups.reduce((sum, [, problems]) => sum + problems.length, 0);
  const solvedCount = PROBLEMS.filter(isSolved).length;
  const controlClass = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 font-sans text-slate-900">
      <h1 className="text-3xl font-bold">Coding gym</h1>
      <p className="mt-2 text-slate-700">
        One problem at a time, with no timer. You can use hints, reveal the tests, and read the
        editorial. Your code here stays in this browser, and does not affect your exam history.
      </p>
      <p className="mt-2 text-sm font-medium text-slate-700">
        {solvedCount} of {PROBLEMS.length} problems solved
      </p>

      <div
        role="search"
        aria-label="Filter problems"
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
      >
        <label className="flex flex-col gap-1">
          Search
          <input
            type="search"
            className={controlClass}
            placeholder="Problem name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          Difficulty
          <select
            className={controlClass}
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Topic
          <select
            className={controlClass}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            <option value="">Any</option>
            {topics.map((id) => (
              <option key={id} value={id}>
                {TOPIC_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            checked={hideSolved}
            onChange={(event) => setHideSolved(event.target.checked)}
          />
          Hide solved
        </label>
      </div>
      <p role="status" className="mt-3 text-xs text-slate-500">
        {shown.length === 0
          ? 'No problems match these filters.'
          : `Showing ${shown.reduce((sum, [, problems]) => sum + problems.length, 0)} of ${total} problems`}
      </p>

      {shown.map(([title, problems, solvedInGroup]) => (
        <section key={title} className="mt-6">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold">
            {title}
            <span className="text-xs font-normal text-slate-500">
              {solvedInGroup} of {groups.find(([name]) => name === title)![1].length} solved
            </span>
          </h2>
          <ul className="mt-2 space-y-1">
            {problems.map((problem) => {
              const solved = isSolved(problem);
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
    <div className="flex h-dvh flex-col font-sans text-slate-900">
      <Calm />
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
        <div className="flex items-center gap-2">
          <ThemeMenu />
          <button
            type="button"
            className="ui-btn rounded border border-slate-300 px-3 py-1 text-sm"
            onClick={() => setShowEditorial((value) => !value)}
          >
            {showEditorial ? 'Hide editorial' : 'Show editorial'}
          </button>
        </div>
      </header>
      {showEditorial && (
        <aside className="max-h-48 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3">
          <Markdown>{problem.editorial}</Markdown>
        </aside>
      )}
      <div className="min-h-0 flex-1">
        <CodeGate problems={[problem]}>
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
        </CodeGate>
      </div>
    </div>
  );
}
