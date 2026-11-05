import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { type SectionContext, short, check, newPage } from './harness.ts';

export async function packs({ context }: SectionContext) {
  const later = await newPage(context);
  console.log('\nQuestion packs and backups');
  await later.getByRole('button', { name: 'Packs and backups' }).click();
  const packFile = (body: object, name = 'pack.json') => ({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(body)),
  });
  const importField = later.getByLabel('Import a question pack');
  await importField.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ nope'),
  });
  await later.getByRole('alert').waitFor();
  check(
    'rejects a broken pack with a message',
    (await later.getByRole('alert').textContent())?.includes('not imported') ?? false,
  );
  const packMcq = {
    id: 'pack-only-question',
    topic: 'git',
    difficulty: 'easy',
    stem: 'A question that only exists in the imported pack?',
    options: ['Yes', 'No', 'Maybe', 'Never'],
    correctIndexes: [0],
    explanation: 'It came from the pack.',
  };
  const packBase = { format: 'mockerrank-pack', name: 'Test pack' };
  const firstExam = parse(readFileSync(join('content', 'exams', 'mock-1.yaml'), 'utf8')) as {
    mcq: string[];
    shortCoding: string;
    longCoding: string;
  };
  await importField.setInputFiles(
    packFile({
      ...packBase,
      problems: [
        { ...short, id: 'pack-custom', checker: { type: 'custom', script: 'return true;' } },
      ],
    }),
  );
  await later.getByText('custom checker').waitFor();
  check('rejects a pack with a custom checker', true);
  const packReload = later.waitForEvent('load');
  await importField.setInputFiles(
    packFile({
      ...packBase,
      mcqs: [packMcq],
      exams: [
        {
          id: 'pack-exam',
          name: 'Pack Exam',
          mcq: ['pack-only-question', ...firstExam.mcq.slice(1)],
          shortCoding: firstExam.shortCoding,
          longCoding: firstExam.longCoding,
        },
      ],
    }),
  );
  await packReload;
  check(
    'adds the pack’s exam',
    (await later.getByRole('combobox').getByRole('option', { name: 'Pack Exam' }).count()) === 1,
  );
  await later.getByRole('combobox').selectOption('pack-exam');
  await later.getByRole('button', { name: 'Start test' }).click();
  await later.getByText('only exists in the imported pack').waitFor();
  check('shows a question from the pack', true);
  await later.getByRole('button', { name: 'Submit test' }).click();
  await later.getByRole('button', { name: 'Submit final answers' }).click();
  await later.getByRole('button', { name: 'Start a new test' }).click();

  await later.getByRole('button', { name: 'Packs and backups' }).click();
  check(
    'lists the installed pack',
    await later.getByRole('list', { name: 'Installed packs' }).getByText('Test pack').isVisible(),
  );
  const exportDownload = later.waitForEvent('download');
  await later.getByRole('button', { name: 'Export all questions' }).click();
  const exported = readFileSync(await (await exportDownload).path(), 'utf8');
  check(
    'exports the whole bank, with the pack',
    exported.includes('pack-only-question') && exported.includes('busiest-badge'),
  );
  await importField.setInputFiles({
    name: 'all.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exported),
  });
  await later.getByText('Nothing new').waitFor();
  check('importing an export changes nothing', true);

  const backupDownload = later.waitForEvent('download');
  await later.getByRole('button', { name: 'Back up my progress' }).click();
  const backup = readFileSync(await (await backupDownload).path(), 'utf8');
  const attemptsBefore = (JSON.parse(backup) as { entries: unknown[] }).entries.length;
  check('backs up progress', attemptsBefore > 0);
  await later.evaluate(() => localStorage.removeItem('mockerrank.history'));
  await later
    .getByLabel('Restore from a backup')
    .setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await later.getByText(`Restored ${attemptsBefore} attempts.`).waitFor();
  check(
    'restores progress',
    (await later.evaluate(() => JSON.parse(localStorage.getItem('mockerrank.history')!).length)) ===
      attemptsBefore,
  );
  await later.getByLabel('Restore from a backup').setInputFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"a":1}'),
  });
  await later.getByText('not a MockerRank progress backup').waitFor();
  check('rejects a file that is not a backup', true);

  const removeReload = later.waitForEvent('load');
  await later.getByRole('button', { name: 'Remove Test pack' }).click();
  await removeReload;
  check(
    'removes a pack',
    (await later.getByRole('combobox').getByRole('option', { name: 'Pack Exam' }).count()) === 0,
  );
}
