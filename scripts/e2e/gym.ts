import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { codingSchema } from '../../src/content/schema.ts';
import {
  type SectionContext,
  check,
  setEditor,
  selectLanguage,
  waitForRun,
  reloaded,
  finishQuickAttempt,
  newPage,
} from './harness.ts';

export async function gym({ context }: SectionContext) {
  const later = await newPage(context);
  await finishQuickAttempt(later);
  console.log('\nCoding gym');
  await later.getByRole('button', { name: 'Coding gym' }).click();
  check(
    'gym lists every problem',
    (await later.getByRole('listitem').count()) === readdirSync(join('content', 'coding')).length,
  );
  await later.getByRole('button', { name: /Quiet Stretch/ }).click();
  await later.getByLabel('Language').waitFor({ timeout: 30000 });
  check('gym has no timer', (await later.getByRole('timer').count()) === 0);
  await selectLanguage(later, 'javascript');
  await setEditor(
    later,
    codingSchema.parse(parse(readFileSync(join('content', 'coding', 'quiet-stretch.yaml'), 'utf8')))
      .languages.javascript!.solution!,
  );
  await later.getByRole('button', { name: 'Submit Code' }).click();
  await waitForRun(later);
  check('gym judges code', await later.getByText(/Submission: 7 of 7 tests passed/).isVisible());
  await later.getByRole('button', { name: 'Show editorial' }).click();
  check(
    'gym shows the editorial',
    await later.getByText('Scan once, keeping the length').isVisible(),
  );
  await later.getByRole('button', { name: 'Show hidden tests' }).click();
  check(
    'gym does not warn about assistance',
    (await later.getByText('marked as assisted').count()) === 0,
  );
  await reloaded(later);
  await later.getByRole('button', { name: 'Coding gym' }).click();
  check(
    'a refresh keeps gym progress',
    await later.getByRole('button', { name: /Quiet Stretch.*Solved/ }).isVisible(),
  );
  const historyBeforeGym = await later.evaluate(
    () => JSON.parse(localStorage.getItem('mockerrank.history')!).length,
  );
  await later.getByRole('button', { name: 'Full exam' }).click();
  await later.getByRole('button', { name: 'View progress' }).click();
  check(
    'the gym stays out of exam history',
    (await later.getByRole('button', { name: /^Review attempt/ }).count()) === historyBeforeGym,
  );
  await later.getByRole('button', { name: 'Back', exact: true }).click();
}
