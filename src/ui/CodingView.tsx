import { useEffect, useState } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import {
  codingAnswer,
  currentCode,
  setCode,
  setHiddenTestsShown,
  storeJudgeResult,
  updateCoding,
  type Attempt,
} from '../attempt/attempt.ts';
import { eventNow } from '../attempt/integrity.ts';
import { assembleSource, limitsFor } from '../content/judging.ts';
import { LANGUAGES, type LanguageId } from '../content/languages.ts';
import type { CodingProblem } from '../content/schema.ts';
import { downloadMessage, subscribeToDownloads } from '../runner/download-progress.ts';
import type { RunResult } from '../runner/types.ts';
import { AssistantPanel } from './AssistantPanel.tsx';
import { CodeEditor } from './CodeEditor.tsx';
import { Markdown } from './Markdown.tsx';
import { TestResults } from './TestResults.tsx';

type Busy = 'run' | 'submit' | 'custom' | null;
type Tab = 'tests' | 'custom' | 'assistant';

interface CustomOutcome {
  compileOutput: string;
  result: RunResult | null;
}

const judgeModule = () => import('../runner/judge.ts');

interface CodingViewProps {
  // Outside an exam, revealing hidden tests has no consequences to warn about.
  practice?: boolean;
  maxAssistantMessages: number;
  attempt: Attempt;
  problem: CodingProblem;
  update: UpdateAttempt;
}

export default function CodingView({
  attempt,
  problem,
  maxAssistantMessages,
  practice = false,
  update,
}: CodingViewProps) {
  const answer = codingAnswer(attempt, problem);
  const language = answer.language;
  const code = currentCode(answer, problem);
  const [busy, setBusy] = useState<Busy>(null);
  const [progress, setProgress] = useState('');
  const [download, setDownload] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('tests');
  const [custom, setCustom] = useState<CustomOutcome | null>(null);

  const latestKind =
    answer.submission && (!answer.run || answer.submission.at > answer.run.at)
      ? 'submission'
      : 'run';
  const [shownKind, setShownKind] = useState<'run' | 'submission'>(latestKind);

  const guarded = async (kind: Exclude<Busy, null>, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    setError('');
    setProgress('');
    try {
      await work();
    } catch (failure) {
      setError(String((failure as Error).message ?? failure));
    } finally {
      setBusy(null);
    }
  };

  const runTests = () =>
    guarded('run', async () => {
      setTab('tests');
      const { runCode } = await judgeModule();
      const result = await runCode(problem, language, code);
      const run = storeJudgeResult(result, language, Date.now(), code);
      update((current) => updateCoding(current, problem, { run }));
      setShownKind('run');
    });

  const submitCode = () =>
    guarded('submit', async () => {
      setTab('tests');
      const { submit } = await judgeModule();
      const result = await submit(problem, language, code, (done, total) =>
        setProgress(`Finished test ${done} of ${total}`),
      );
      const submission = storeJudgeResult(result, language, Date.now(), code);
      update((current) => updateCoding(current, problem, { submission }));
      setShownKind('submission');
    });

  const runCustom = () =>
    guarded('custom', async () => {
      const { runProgram } = await judgeModule();
      const source = assembleSource(problem, language, code);
      const limits = limitsFor(problem, language);
      setCustom(await runProgram(language, source, answer.customInput, limits));
    });

  useEffect(() => subscribeToDownloads((update) => setDownload(downloadMessage(update))), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      void (event.shiftKey ? submitCode() : runTests());
    };
    // Capture, so the editor does not treat the shortcut as inserting a line.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const shownResult = shownKind === 'submission' ? answer.submission : answer.run;
  const buttonClass = 'ui-btn rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50';

  return (
    <div className="grid h-full grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="overflow-y-auto border-r border-slate-200 bg-white p-5">
        <h1 className="text-xl font-bold">{problem.title}</h1>
        {problem.debug && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">
            Fix the code: the editor already holds a program with a bug. Run it, work out why it
            fails, and correct it.
          </p>
        )}
        <div className="mt-3 space-y-4">
          <Markdown>{problem.statement}</Markdown>
          <div>
            <h2 className="text-sm font-semibold">Input format</h2>
            <Markdown>{problem.inputFormat}</Markdown>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Output format</h2>
            <Markdown>{problem.outputFormat}</Markdown>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Constraints</h2>
            <Markdown>{problem.constraints}</Markdown>
          </div>
          {problem.sampleTests.map((test, index) => (
            <div key={index}>
              <h2 className="text-sm font-semibold">Sample {index + 1}</h2>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <pre className="overflow-auto rounded bg-slate-100 p-2 font-mono text-xs">
                  {test.input}
                </pre>
                <pre className="overflow-auto rounded bg-slate-100 p-2 font-mono text-xs">
                  {test.output}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-col bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-1">
          <label className="text-sm font-medium">
            Language{' '}
            <select
              className="rounded border border-slate-300 bg-white p-1 text-sm"
              value={language}
              onChange={(event) => {
                const next = event.target.value as LanguageId;
                update((current) => updateCoding(current, problem, { language: next }));
              }}
            >
              {Object.keys(problem.languages).map((id) => (
                <option key={id} value={id}>
                  {LANGUAGES[id as LanguageId].label}
                </option>
              ))}
            </select>
          </label>
          {language === 'java' && (
            <span className="text-xs text-slate-500">
              Java runs on CheerpJ, and needs internet.
            </span>
          )}
        </div>

        <CodeEditor
          onClipboard={(type) => update(eventNow(type))}
          path={`${problem.id}/${language}`}
          language={language}
          code={code}
          onChange={(next) => update((current) => setCode(current, problem, language, next))}
        />

        <div className="flex items-center gap-2 border-t border-slate-200 px-2 py-1.5">
          <button
            type="button"
            title="Ctrl+Enter"
            disabled={busy !== null}
            className={`${buttonClass} border border-slate-300 bg-white`}
            onClick={() => void runTests()}
          >
            Run Code
          </button>
          <button
            type="button"
            title="Ctrl+Shift+Enter"
            disabled={busy !== null}
            className={`${buttonClass} ui-btn-primary bg-emerald-700 text-white`}
            onClick={() => void submitCode()}
          >
            Submit Code
          </button>
          <div role="status" className="text-xs text-slate-600">
            {busy &&
              (download ??
                (language === 'java'
                  ? `Running… Java takes a while to start the first time. ${progress}`
                  : `Running… ${progress}`))}
          </div>
        </div>

        <div className="flex h-2/5 min-h-0 flex-col border-t border-slate-200">
          <div role="tablist" className="flex items-center gap-1 border-b border-slate-200 px-2">
            {(
              [
                ['tests', 'Test results'],
                ['custom', 'Custom input'],
                ...(attempt.assistantEnabled === false ? [] : [['assistant', 'AI assistant']]),
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`px-3 py-1.5 text-sm ${tab === id ? 'border-b-2 border-emerald-700 font-semibold' : 'text-slate-600'}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {attempt.hiddenTestsRevealed && !practice && (
                <span className="text-xs text-amber-800">This attempt is marked as assisted.</span>
              )}
              <button
                type="button"
                className="ui-btn rounded border border-slate-300 px-2 py-0.5 text-xs"
                title={
                  practice ? undefined : 'Revealing hidden tests marks this attempt as assisted.'
                }
                onClick={() =>
                  update((current) => setHiddenTestsShown(current, !current.showHiddenTests))
                }
              >
                {attempt.showHiddenTests ? 'Hide hidden tests' : 'Show hidden tests'}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {error && (
              <p role="alert" className="mb-2 rounded bg-red-50 p-2 text-sm text-red-800">
                {error}
              </p>
            )}
            {/* Stays mounted, so a reply in progress survives switching tabs. */}
            {attempt.assistantEnabled !== false && (
              <div className={tab === 'assistant' ? '' : 'hidden'}>
                <AssistantPanel
                  attempt={attempt}
                  problem={problem}
                  language={language}
                  code={code}
                  maxMessages={maxAssistantMessages}
                  update={update}
                />
              </div>
            )}
            {tab === 'assistant' ? null : tab === 'tests' ? (
              <TestResults
                problem={problem}
                result={shownResult}
                kind={shownKind}
                showHidden={attempt.showHiddenTests}
              />
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">
                  Input
                  <textarea
                    className="mt-1 block h-20 w-full rounded border border-slate-300 p-2 font-mono text-xs"
                    value={answer.customInput}
                    onChange={(event) => {
                      const customInput = event.target.value;
                      update((current) => updateCoding(current, problem, { customInput }));
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy !== null}
                  className={`${buttonClass} border border-slate-300`}
                  onClick={() => void runCustom()}
                >
                  Run with custom input
                </button>
                {custom && (
                  <pre className="rounded bg-slate-100 p-2 font-mono text-xs whitespace-pre-wrap">
                    {custom.result
                      ? `${custom.result.stdout}${custom.result.stderr ? `\n${custom.result.stderr}` : ''}${
                          custom.result.status === 'ok' ? '' : `\n(${custom.result.status})`
                        }`
                      : custom.compileOutput}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
