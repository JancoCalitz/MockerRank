import { execFileSync } from 'node:child_process';
import { build, preview } from 'vite';
import {
  type SectionContext,
  check,
  problemFile,
  selectLanguage,
  setEditor,
  shot,
  waitForRun,
  watch,
} from './harness.ts';

const PASSWORD = 'four random words here';
const OUT = 'dist-locked';
const LOCKED_URL = 'http://localhost:4178/MockerRank/';

// Builds a second copy of the site locked with a password, as the Pages workflow does, and
// checks that nothing is readable before the password is entered.
export async function locked({ context }: SectionContext) {
  console.log('\nLocked build');
  process.env.CONTENT_PASSWORD = PASSWORD;
  try {
    await build({ build: { outDir: OUT, emptyOutDir: true }, logLevel: 'error' });
  } finally {
    delete process.env.CONTENT_PASSWORD;
  }
  let safe = true;
  try {
    execFileSync('node', ['scripts/check-locked-build.ts', OUT], { stdio: 'pipe' });
  } catch {
    safe = false;
  }
  check('the built files hold no readable questions', safe);

  const server = await preview({
    base: '/MockerRank/',
    build: { outDir: OUT },
    preview: { port: 4178, strictPort: true },
    logLevel: 'error',
  });
  try {
    const page = await context.newPage();
    watch(page);
    await page.goto(LOCKED_URL);
    const heading = page.getByRole('heading', { name: 'Enter the password' });
    await heading.waitFor();
    check('asks for the password first', await heading.isVisible());
    await shot(page, 'lock-screen');
    check(
      'shows no questions before unlocking',
      !(await page.evaluate(() => document.body.innerText.includes('Mock Exam'))),
    );

    const password = page.getByLabel('Password');
    await password.fill('not the password');
    await page.getByRole('button', { name: 'Unlock' }).click();
    const wrong = page.getByText('That password is not right.');
    await wrong.waitFor();
    check('refuses a wrong password', await wrong.isVisible());

    await page.getByLabel('Keep this device unlocked').uncheck();
    await password.fill(PASSWORD);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('button', { name: 'Start test' }).waitFor();
    check('opens with the right password', true);
    await page.reload();
    await heading.waitFor();
    check('asks again when not kept unlocked', await heading.isVisible());

    await password.fill(PASSWORD);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.getByRole('button', { name: 'Start test' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Start test' }).waitFor();
    check('stays unlocked on a kept device', true);

    console.log('\nLocked build: encrypted tests');
    await page.getByRole('button', { name: 'Coding gym' }).click();
    await page.getByRole('button', { name: /Quiet Stretch/ }).click();
    await page.getByLabel('Language').waitFor({ timeout: 30000 });
    await selectLanguage(page, 'javascript');
    await setEditor(page, problemFile('quiet-stretch').languages.javascript!.solution!);
    await page.getByRole('button', { name: 'Submit Code' }).click();
    await waitForRun(page);
    check(
      'judges with the encrypted large tests',
      await page.getByText(/Submission: 7 of 7 tests passed/).isVisible(),
    );

    await page.getByRole('button', { name: 'All problems' }).click();
    await page.getByRole('button', { name: 'Packs and backups' }).click();
    await page.getByRole('button', { name: 'Lock this device' }).click();
    await heading.waitFor();
    check('locks the device again', await heading.isVisible());
  } finally {
    await server.close();
  }
}
