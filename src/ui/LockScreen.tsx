import { useState, type FormEvent } from 'react';
import { unlock, WrongPasswordError } from '../content/lock.ts';

// Shown on a site built with a password, before anything else loads. The password unlocks the
// encrypted questions in this browser; it is never sent anywhere.
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await unlock(password, remember);
      onUnlocked();
    } catch (failure) {
      setError(
        failure instanceof WrongPasswordError
          ? 'That password is not right.'
          : String((failure as Error).message ?? failure),
      );
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16 font-sans text-slate-900">
      <form
        className="ui-card rounded-lg border border-slate-200 bg-white p-6"
        onSubmit={(event) => void submit(event)}
      >
        <p className="app-logo text-lg font-semibold">MockerRank</p>
        <h1 className="mt-2 text-2xl font-bold">Enter the password</h1>
        <p className="mt-2 text-sm text-slate-700">
          The questions on this site are locked. Ask the person who shared it for the password.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            // The only thing on the page, so it can take focus straight away.
            autoFocus
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          Keep this device unlocked
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!password || busy}
          className="ui-btn ui-btn-primary mt-4 rounded bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
