import { useState } from 'react';
import { startAttempt, type Attempt } from '../attempt/attempt.ts';
import { loadHistory, seenQuestionIds } from '../attempt/history.ts';
import { EXAMS } from '../content/bank.ts';
import { generateExam } from '../content/generate.ts';
import { LANGUAGES } from '../content/languages.ts';
import { enterFullscreen } from './useIntegrityTracking.ts';

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

interface LandingProps {
  onStart: (attempt: Attempt) => void;
  onShowProgress?: () => void;
}

const RANDOM_EXAM = 'random';

export function Landing({ onStart, onShowProgress }: LandingProps) {
  const [examId, setExamId] = useState(EXAMS[0]?.id);
  // Built once, so what is shown here is exactly what starts.
  const [randomExam] = useState(() => generateExam(seenQuestionIds(loadHistory()), Date.now()));
  const [missing] = useState(missingFeatures);
  const [strict, setStrict] = useState(false);
  const [fullscreenChoice, setFullscreenChoice] = useState<boolean | null>(null);
  const isRandom = examId === RANDOM_EXAM;
  const exam = isRandom ? randomExam : EXAMS.find((candidate) => candidate.id === examId);
  const requireFullscreen = fullscreenChoice ?? exam?.proctoring.requireFullscreen ?? false;
  const languages = Object.values(LANGUAGES)
    .map((language) => language.label)
    .join(', ');

  if (!exam) {
    return <p className="p-8">No exams are available.</p>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 font-sans text-slate-900">
      <h1 className="text-3xl font-bold">{exam.name}</h1>

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
            <option value={RANDOM_EXAM}>Random exam, avoiding questions you have seen</option>
          </select>
        </label>
      )}

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ui-card rounded-lg border border-slate-200 p-4">
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

      {/* Folded away, so choosing an exam and starting come first. */}
      <details className="mt-6">
        <summary className="cursor-pointer font-semibold">Before you start: the rules</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>The timer starts when you click Start, and keeps running if you close this tab.</li>
          <li>Your answers save automatically in this browser, and the test submits at time up.</li>
          <li>
            Coding questions have sample tests you can run, and hidden tests that run when you
            submit. Revealing hidden tests marks the attempt as assisted.
          </li>
          <li>
            Your report records the time spent on each question, and how often you leave the test,
            copy or paste in the editor, right-click, or resize the window. It records that these
            happened, never what you copied. None of this affects your score.
          </li>
          <li>
            Coding questions have an AI assistant for hints, using your own API key, with up to{' '}
            {exam.assistant.maxMessagesPerQuestion} messages per question. Your conversations appear
            in your report.
          </li>
          <li>
            Languages: {languages}. Each one downloads the first time you use it, which can take a
            minute. Java needs an internet connection.
          </li>
        </ul>
      </details>

      {missing.length > 0 && (
        <p role="alert" className="mt-6 rounded bg-red-50 p-3 text-sm text-red-800">
          This browser is missing {missing.join(', ')}, so the test will not work properly. Use a
          current version of Chrome or Edge.
        </p>
      )}

      <label className="mt-6 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={strict}
          onChange={(event) => setStrict(event.target.checked)}
        />
        Strict mode: no AI assistant
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={requireFullscreen}
          onChange={(event) => setFullscreenChoice(event.target.checked)}
        />
        Require full screen
      </label>

      <button
        type="button"
        className="mt-4 ui-btn ui-btn-primary rounded bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800"
        onClick={() => {
          if (requireFullscreen) enterFullscreen();
          onStart(
            startAttempt(exam, Date.now(), {
              assistantEnabled: !strict,
              requireFullscreen,
              generated: isRandom,
            }),
          );
        }}
      >
        Start test
      </button>
      {onShowProgress && (
        <button
          type="button"
          className="mt-4 ml-2 ui-btn rounded border border-slate-300 px-5 py-2 font-semibold hover:bg-slate-50"
          onClick={onShowProgress}
        >
          View progress
        </button>
      )}

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
