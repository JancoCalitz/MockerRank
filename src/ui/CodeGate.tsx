import { useEffect, useState, type ReactNode } from 'react';
import { loadProblemCode, problemCodeLoaded } from '../content/bank.ts';
import type { CodingProblem } from '../content/schema.ts';

// Shows its children once the code for these problems has loaded, which is immediately if it
// already has. Failing to load, such as while offline, must not lose the person's place.
export function CodeGate({
  problems,
  children,
}: {
  problems: readonly CodingProblem[];
  children: ReactNode;
}) {
  const [, setLoadedCount] = useState(0);
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const ready = problems.every(problemCodeLoaded);
  const key = problems.map((problem) => problem.id).join();

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    void Promise.all(problems.map(loadProblemCode)).then(
      () => {
        if (!cancelled) setLoadedCount((count) => count + 1);
      },
      () => {
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
    // The key stands in for the list, which is a new array on most renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, attempts]);

  if (ready) return children;
  if (!error) return <p className="p-6 font-sans text-slate-600">Loading the questions…</p>;
  return (
    <div role="alert" className="p-6 font-sans text-sm text-red-800">
      <p>Could not load this question. Check your internet connection, and try again.</p>
      <button
        type="button"
        className="mt-2 rounded border border-red-300 px-3 py-1 font-medium"
        onClick={() => {
          setError(false);
          setAttempts((count) => count + 1);
        }}
      >
        Try again
      </button>
    </div>
  );
}
