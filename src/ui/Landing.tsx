import { useState } from 'react';
import { startAttempt, type Attempt } from '../attempt/attempt.ts';
import { EXAMS } from '../content/bank.ts';
import { LANGUAGES } from '../content/languages.ts';

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
function missingFeatures(): string[] {
  const checks: [string, boolean][] = [
    ['WebAssembly', typeof WebAssembly === 'object'],
    ['Web Workers', typeof Worker === 'function'],
    ['local storage', storageWorks()],
  ];
  return checks.filter(([, ok]) => !ok).map(([name]) => name);
}

export function Landing({ onStart }: { onStart: (attempt: Attempt) => void }) {
  const [examId, setExamId] = useState(EXAMS[0]?.id);
  const [missing] = useState(missingFeatures);
  const exam = EXAMS.find((candidate) => candidate.id === examId);
  const languages = Object.values(LANGUAGES)
    .map((language) => language.label)
    .join(', ');

  if (!exam) {
    return <p className="p-8">No exams are available.</p>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans text-slate-900">
      <p className="font-semibold text-emerald-700">MockerRank</p>
      <h1 className="mt-1 text-3xl font-bold">{exam.name}</h1>

      {EXAMS.length > 1 && (
        <label className="mt-4 block text-sm font-medium">
          Exam{' '}
          <select
            className="ml-2 rounded border border-slate-300 p-1"
            value={examId}
            onChange={(event) => setExamId(event.target.value)}
          >
            {EXAMS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-4">
        <div>
          <dt className="text-sm text-slate-600">Duration</dt>
          <dd className="font-semibold">{exam.durationMinutes} minutes</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Questions</dt>
          <dd className="font-semibold">
            20: {exam.mcq.length} multiple choice, 1 short coding, 1 long coding
          </dd>
        </div>
      </dl>

      <section className="mt-6">
        <h2 className="font-semibold">Before you start</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>The timer starts when you click Start, and keeps running if you close this tab.</li>
          <li>Your answers save automatically in this browser, and the test submits at time up.</li>
          <li>
            Coding questions have sample tests you can run, and hidden tests that run when you
            submit. Revealing hidden tests marks the attempt as assisted.
          </li>
          <li>Time spent on each question is recorded for your report.</li>
          <li>
            Languages: {languages}. Each one downloads the first time you use it, which can take a
            minute. Java needs an internet connection.
          </li>
        </ul>
      </section>

      {missing.length > 0 && (
        <p role="alert" className="mt-6 rounded bg-red-50 p-3 text-sm text-red-800">
          This browser is missing {missing.join(', ')}, so the test will not work properly. Use a
          current version of Chrome or Edge.
        </p>
      )}

      <button
        type="button"
        className="mt-6 rounded bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
        onClick={() => onStart(startAttempt(exam, Date.now()))}
      >
        Start test
      </button>

      <p className="mt-10 text-xs text-slate-500">
        Java runs on{' '}
        <a className="underline" href="https://cheerpj.com" target="_blank" rel="noreferrer">
          CheerpJ
        </a>
        .
      </p>
    </main>
  );
}
