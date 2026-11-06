import { useState, type ChangeEvent } from 'react';
import { exportProgress, importProgress } from '../attempt/backup.ts';
import { BUILT_IN, EXAMS, loadAllProblemCode, MCQS, PROBLEMS } from '../content/bank.ts';
import { exportPack, loadPacks, parsePack, savePacks } from '../content/packs.ts';

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function readChosenFile(event: ChangeEvent<HTMLInputElement>): Promise<string | null> {
  const file = event.target.files?.[0];
  // Clearing this lets the same file be chosen again, such as after fixing a mistake in it.
  event.target.value = '';
  return file ? file.text() : null;
}

export function DataScreen() {
  const [packs] = useState(loadPacks);
  const [packErrors, setPackErrors] = useState<string[]>([]);
  const [packMessage, setPackMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');

  const importPack = async (event: ChangeEvent<HTMLInputElement>) => {
    const text = await readChosenFile(event);
    if (text === null) return;
    setPackErrors([]);
    setPackMessage('');
    // Comparing against the problems, to skip ones already here, needs all of their code.
    await loadAllProblemCode();
    const result = parsePack(text, { mcqs: MCQS, problems: PROBLEMS, exams: EXAMS });
    if (!result.ok) return setPackErrors(result.errors);
    const { pack, skipped } = result;
    const added = pack.mcqs.length + pack.problems.length + pack.exams.length;
    if (added === 0) {
      return setPackMessage(`Nothing new: all ${skipped} items in this pack are already here.`);
    }
    if (!savePacks([...packs, pack])) {
      return setPackErrors(['Your browser could not save this pack, as its storage may be full.']);
    }
    // The question bank is read as the app starts.
    window.location.reload();
  };

  const removePack = (index: number) => {
    savePacks(packs.filter((_, position) => position !== index));
    window.location.reload();
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const text = await readChosenFile(event);
    if (text === null) return;
    const result = importProgress(text);
    setProgressMessage(result.ok ? `Restored ${result.imported} attempts.` : result.error);
  };

  const buttonClass = 'ui-btn rounded border border-slate-300 px-3 py-1.5 text-sm font-medium';
  const fileClass = 'mt-1 block text-sm';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 font-sans text-slate-900">
      <h1 className="text-3xl font-bold">Packs and backups</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Question packs</h2>
        <p className="mt-1 text-sm text-slate-700">
          The app has {BUILT_IN.mcqs} multiple choice questions and {BUILT_IN.problems} coding
          problems of its own. A pack adds more, in this browser only. Packs are JSON or YAML files,
          and only import ones from people you trust, as their answers and tests are not checked for
          you.
        </p>
        <label className="mt-3 block text-sm font-medium">
          Import a question pack
          <input
            type="file"
            accept=".json,.yaml,.yml"
            className={fileClass}
            onChange={(event) => void importPack(event)}
          />
        </label>
        {packMessage && (
          <p role="status" className="mt-2 text-sm">
            {packMessage}
          </p>
        )}
        {packErrors.length > 0 && (
          <div role="alert" className="mt-2 rounded bg-red-50 p-3 text-sm text-red-800">
            <p className="font-medium">This pack was not imported:</p>
            <ul className="mt-1 list-disc pl-5">
              {packErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        {packs.length > 0 && (
          <ul aria-label="Installed packs" className="mt-3 space-y-1">
            {packs.map((pack, index) => (
              <li
                key={`${pack.name}-${index}`}
                className="flex items-center justify-between gap-3 rounded border border-slate-200 p-2 text-sm"
              >
                <span>
                  {pack.name}: {pack.mcqs.length} multiple choice, {pack.problems.length} coding,{' '}
                  {pack.exams.length} exams
                </span>
                <button
                  type="button"
                  className="text-xs underline"
                  aria-label={`Remove ${pack.name}`}
                  onClick={() => removePack(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className={`${buttonClass} mt-3`}
          onClick={() =>
            void loadAllProblemCode().then(() =>
              download(
                'mockerrank-questions.json',
                exportPack('All questions', { mcqs: MCQS, problems: PROBLEMS, exams: EXAMS }),
              ),
            )
          }
        >
          Export all questions
        </button>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Your progress</h2>
        <p className="mt-1 text-sm text-slate-700">
          Your attempts are only stored in this browser, and clearing its data deletes them. A
          backup file keeps them safe, or moves them to another browser.
        </p>
        <button
          type="button"
          className={`${buttonClass} mt-3`}
          onClick={() => download('mockerrank-progress.json', exportProgress())}
        >
          Back up my progress
        </button>
        <label className="mt-3 block text-sm font-medium">
          Restore from a backup
          <input
            type="file"
            accept=".json"
            className={fileClass}
            onChange={(event) => void importBackup(event)}
          />
        </label>
        {progressMessage && (
          <p role="status" className="mt-2 text-sm">
            {progressMessage}
          </p>
        )}
      </section>
    </main>
  );
}
