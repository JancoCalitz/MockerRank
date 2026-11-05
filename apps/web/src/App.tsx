import { useEffect, useState } from 'react';

interface Health {
  status: string;
  dependencies: Record<string, string>;
}

type HealthState = { kind: 'loading' } | { kind: 'loaded'; health: Health } | { kind: 'failed' };

export function App() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        const health = (await response.json()) as Health;
        setState({ kind: 'loaded', health });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'failed' });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-8 font-sans text-slate-900">
      <h1 className="text-3xl font-bold">MockerRank</h1>
      <p className="mt-1 text-slate-600">Assessment practice environment</p>

      <section className="mt-8 rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold">System health</h2>
        {state.kind === 'loading' && <p className="mt-2 text-slate-600">Checking…</p>}
        {state.kind === 'failed' && (
          <p className="mt-2 font-medium text-red-700">The API could not be reached.</p>
        )}
        {state.kind === 'loaded' && (
          <>
            <p
              className={`mt-2 font-medium ${
                state.health.status === 'ok' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              API: {state.health.status}
            </p>
            <ul className="mt-2 text-sm text-slate-600">
              {Object.entries(state.health.dependencies).map(([name, status]) => (
                <li key={name}>
                  {name}: {status}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
