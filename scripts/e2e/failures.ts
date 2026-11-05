import {
  type SectionContext,
  LONG_WAIT_MS,
  short,
  check,
  watch,
  goTo,
  setEditor,
  selectLanguage,
  waitForRun,
  openApp,
  newPage,
} from './harness.ts';

export async function failures({ browser, context }: SectionContext) {
  const later = await newPage(context);
  console.log('\nA language that fails to download');
  await context.route('**/runtimes/pyodide/**', (route) => route.abort());
  await later.getByRole('button', { name: 'Start test' }).click();
  await goTo(later, 19);
  await later.getByLabel('Language').waitFor({ timeout: 30000 });
  await selectLanguage(later, 'python');
  await later.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(later);
  const failureAlert = later
    .getByRole('alert')
    .filter({ hasText: 'Could not start this language' });
  check('explains the failure', await failureAlert.isVisible());
  check('the app keeps working', await later.getByRole('timer').isVisible());
  await context.unroute('**/runtimes/pyodide/**');
  await setEditor(later, short.languages.python!.solution!);
  await later.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(later);
  check(
    'works on trying again',
    (await later.locator('section').nth(1).textContent())?.includes(
      'Sample tests: 2 of 2 tests passed',
    ) ?? false,
  );
  await later.getByRole('button', { name: 'Submit test' }).click();
  await later.getByRole('button', { name: 'Submit final answers' }).click();
  await later.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  await later.getByRole('button', { name: 'Start a new test' }).click();

  console.log('\nDownload progress');
  const fresh = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    serviceWorkers: 'block',
  });
  const newcomer = await fresh.newPage();
  watch(newcomer);
  await openApp(newcomer);
  await newcomer.getByRole('button', { name: 'Start test' }).click();
  await goTo(newcomer, 19);
  await newcomer.getByLabel('Language').waitFor({ timeout: 60000 });
  await selectLanguage(newcomer, 'c');
  await newcomer.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    const status = document.querySelector('section:nth-of-type(2) [role=status]')!;
    new MutationObserver(() => seen.push(status.textContent ?? '')).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await newcomer.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(newcomer);
  const messages = await newcomer.evaluate(() => (window as unknown as { seen: string[] }).seen);
  check(
    'shows download progress on first use',
    messages.some((text) => /Downloading this language, \d+ of \d+ MB/.test(text)),
    messages.slice(0, 5).join(' | '),
  );
  await fresh.close();
}
