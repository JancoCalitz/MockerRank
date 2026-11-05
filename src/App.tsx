function storageWorks(): boolean {
  try {
    const key = 'mockerrank-check';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Everything the app relies on to run code and keep an attempt in the browser.
function browserChecks() {
  return [
    { name: 'WebAssembly', ok: typeof WebAssembly === 'object' },
    { name: 'Web Workers', ok: typeof Worker === 'function' },
    { name: 'Local storage', ok: storageWorks() },
  ];
}

export function App() {
  const checks = browserChecks();
  const ready = checks.every((check) => check.ok);

  return (
    <main className="mx-auto max-w-xl p-8 font-sans text-slate-900">
      <h1 className="text-3xl font-bold">MockerRank</h1>
      <p className="mt-1 text-slate-600">Assessment practice environment</p>

      <section className="mt-8 rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold">Browser check</h2>
        <p className={`mt-2 font-medium ${ready ? 'text-green-700' : 'text-red-700'}`}>
          {ready ? 'This browser is ready.' : 'This browser is missing a required feature.'}
        </p>
        <ul className="mt-2 text-sm text-slate-600">
          {checks.map((check) => (
            <li key={check.name}>
              {check.name}: {check.ok ? 'ok' : 'unavailable'}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
