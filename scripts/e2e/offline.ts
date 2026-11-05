import type { Page } from 'playwright-core';
import type { LanguageId } from '../../src/content/languages.ts';
import {
  check,
  LONG_WAIT_MS,
  openApp,
  reloaded,
  selectLanguage,
  type SectionContext,
  waitForRun,
  watch,
} from './harness.ts';

async function run(page: Page, language: LanguageId) {
  await selectLanguage(page, language);
  await page.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(page);
  return page.getByText(/Sample tests: \d of \d tests passed/).isVisible();
}

async function openProblem(page: Page, title: RegExp) {
  await page.getByRole('button', { name: 'Coding gym' }).click();
  await page.getByRole('button', { name: title }).click();
  await page.getByLabel('Language').waitFor({ timeout: 60000 });
}

const cannotStart = (page: Page) =>
  page
    .getByRole('alert')
    .filter({ hasText: 'Could not start this language' })
    .waitFor({ timeout: LONG_WAIT_MS });

export async function offline({ browser }: SectionContext) {
  console.log('\nWorking offline');
  // Service workers are blocked in other sections, so this one needs its own profile.
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, {
    timeout: 60000,
  });
  check('installs for offline use', true);

  // Use some languages while connected, so they are saved.
  await openProblem(page, /Peak Delivery Window/);
  for (const language of ['python', 'cpp', 'typescript'] as const) await run(page, language);

  await context.setOffline(true);
  await reloaded(page);
  check('the app opens with no connection', (await page.locator('#root > *').count()) > 0);

  await openProblem(page, /Quiet Stretch/);
  check('opens a problem never opened before', true);

  for (const language of ['javascript', 'python', 'cpp', 'typescript'] as const) {
    check(`runs ${language} with no connection`, await run(page, language));
  }

  await selectLanguage(page, 'csharp');
  await page.getByRole('button', { name: 'Run Code' }).click();
  await cannotStart(page);
  check('explains that a language never used before needs a connection', true);

  await context.setOffline(false);
  check('that language works once connected again', await run(page, 'csharp'));
  await context.setOffline(true);
  await reloaded(page);
  await openProblem(page, /Quiet Stretch/);
  check('and then works with no connection', await run(page, 'csharp'));

  await selectLanguage(page, 'java');
  await page.getByRole('button', { name: 'Run Code' }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'Java needs an internet connection' })
    .waitFor({ timeout: 60000 });
  check('says Java needs a connection', true);
  await context.close();
}
