import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Mcq } from '../../src/content/schema.ts';
import {
  check,
  LONG_WAIT_MS,
  newPage,
  problemFile,
  reloaded,
  type SectionContext,
  selectLanguage,
  setEditor,
  waitForRun,
} from './harness.ts';

const allMcqs = readdirSync(join('content', 'mcq')).flatMap(
  (name) => parse(readFileSync(join('content', 'mcq', name), 'utf8')) as Mcq[],
);

// Fast enough on small inputs, but quadratic, so it should run out of time on the large test.
const SLOW_QUIET_STRETCH = `const t = require('fs').readFileSync(0, 'utf8').split(/\\s+/).filter(Boolean).map(Number);
const [n, limit] = t;
let best = 0;
for (let i = 0; i < n; i++) {
  let run = 0;
  for (let j = i; j < n && t[2 + j] <= limit; j++) run++;
  best = Math.max(best, run);
}
console.log(best);
`;

export async function practice({ context }: SectionContext) {
  const page = await newPage(context);

  console.log('\nShuffled answers');
  await page.getByRole('button', { name: 'Start test' }).click();
  const options = () =>
    page
      .locator('fieldset label')
      .evaluateAll((labels) => labels.map((label) => label.textContent ?? ''));
  await page.locator('fieldset label').first().waitFor();
  const before = await options();
  await reloaded(page);
  await page.locator('fieldset label').first().waitFor();
  check('keeps the order after a refresh', (await options()).join() === before.join());

  console.log('\nPractising from mistakes');
  await page.getByRole('button', { name: 'Submit test' }).click();
  await page.getByRole('button', { name: 'Submit final answers' }).click();
  await page.getByRole('heading', { name: 'Test submitted' }).waitFor();
  await page.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  await page.getByRole('button', { name: 'View progress' }).click();
  const retry = page.getByRole('button', { name: /Retry 10 of the 18 questions you got wrong/ });
  await retry.waitFor();
  check('offers the questions that were got wrong', true);
  await retry.click();
  await page.getByText('Question 1 of 10').waitFor();
  check('starts a drill of those questions', true);

  const firstId = await page.evaluate(
    () => JSON.parse(localStorage.getItem('mockerrank.drill')!).questionIds[0] as string,
  );
  const mcq = allMcqs.find((candidate) => candidate.id === firstId)!;
  for (const index of mcq.correctIndexes) {
    await page
      .getByRole(mcq.multiSelect ? 'checkbox' : 'radio', { name: mcq.options[index], exact: true })
      .check();
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByText('✓ Correct', { exact: true }).waitFor();
  const stillMissed = await page.evaluate(
    (id) => id in JSON.parse(localStorage.getItem('mockerrank.missed')!).questions,
    firstId,
  );
  check('forgets a question once it is answered correctly', !stillMissed);
  await page.getByRole('button', { name: 'End drill' }).click();
  await page.getByRole('button', { name: /you got wrong/ }).waitFor();
  check('offers the rest from the drill screen', true);

  console.log('\nRecommended problems');
  await page.getByRole('button', { name: 'Coding gym' }).click();
  await page.getByRole('heading', { name: 'Recommended for you' }).waitFor();
  check('recommends problems missed in the exam', true);
  const listed = await page.getByRole('listitem').count();
  check(
    'lists each problem only once',
    listed === readdirSync(join('content', 'coding')).length,
    String(listed),
  );

  console.log('\nFix the code');
  await page.getByRole('heading', { name: 'Fix the code' }).waitFor();
  await page.getByRole('button', { name: /Fix the Highest Reading/ }).click();
  await page.getByText('the editor already holds a program with a bug').waitFor();
  check('explains the kind of question', true);
  await page.getByLabel('Language').waitFor({ timeout: 30000 });
  await selectLanguage(page, 'javascript');
  await page.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(page);
  check(
    'the code as given fails a sample',
    await page.getByText('Sample tests: 1 of 2 tests passed').isVisible(),
  );
  await setEditor(page, problemFile('fix-highest-reading').languages.javascript!.solution!);
  await page.getByRole('button', { name: 'Submit Code' }).click();
  await waitForRun(page);
  check(
    'the fixed code passes',
    await page.getByText(/Submission: 6 of 6 tests passed/).isVisible(),
  );
  await page.getByRole('button', { name: 'All problems' }).click();

  console.log('\nSpeed feedback');
  await page.getByRole('button', { name: /Quiet Stretch/ }).click();
  await page.getByLabel('Language').waitFor({ timeout: 30000 });
  await selectLanguage(page, 'javascript');
  await setEditor(page, SLOW_QUIET_STRETCH);
  await page.getByRole('button', { name: 'Submit Code' }).click();
  await waitForRun(page);
  check('labels the large test', await page.getByText('(large)').first().isVisible());
  check(
    'says a slow program needs a better approach',
    await page.getByText('Too slow on the largest input').isVisible(),
  );
  check(
    'shows the time limit',
    await page
      .getByText(/ms of 5 s/)
      .first()
      .isVisible(),
  );
}
