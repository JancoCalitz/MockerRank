// What the end-to-end sections share. See scripts/test-e2e.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { parse } from 'yaml';
import type { LanguageId } from '../../src/content/languages.ts';
import { codingSchema } from '../../src/content/schema.ts';

export const URL = 'http://localhost:4177/MockerRank/';
export const LONG_WAIT_MS = 240_000;

export interface SectionContext {
  browser: Browser;
  // A browser profile of this section's own, so it starts with nothing saved.
  context: BrowserContext;
}

export function problemFile(id: string) {
  return codingSchema.parse(parse(readFileSync(join('content', 'coding', `${id}.yaml`), 'utf8')));
}

export const short = problemFile('busiest-badge');
export const long = problemFile('delivery-route-time');

let failed = 0;
export const failures = () => failed;
export const addFailure = () => {
  failed++;
};

export function check(name: string, passed: boolean, detail = '') {
  if (!passed) failed++;
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `: ${detail}`}`);
}

export const pageErrors: string[] = [];
export function watch(page: Page) {
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    // The mocked providers return errors on purpose.
    const isProvider = /api\.(anthropic|openai)\.com/.test(response.url());
    if (response.status() >= 400 && !isProvider) {
      pageErrors.push(`${response.status()} ${response.url()}`);
    }
  });
}

export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (dir) await page.screenshot({ path: join(dir, `${name}.png`) });
}

export const tile = (page: Page, number: number) =>
  page.getByRole('button', { name: new RegExp(`^Question ${number},`) });

export async function goTo(page: Page, number: number) {
  await tile(page, number).click();
}

export async function answeredCount(page: Page) {
  const labels = await page
    .getByRole('navigation', { name: 'Questions' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? ''));
  return labels.filter((label) => /, answered/.test(label)).length;
}

export function timerSeconds(text: string) {
  const parts = text.split(':').map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export async function readTimer(page: Page) {
  return timerSeconds((await page.getByRole('timer').textContent()) ?? '');
}

export async function sectionScores(page: Page) {
  return page
    .getByRole('list', { name: 'Score by section' })
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map((item) => (item.textContent ?? '').replace(/\d+% of total/, '')),
    );
}

// Moves the saved deadline. The app saves every second, which would overwrite this, so saving is
// also switched off for the rest of this page's life. The next page load reads the new deadline.
export async function setDeadline(page: Page, fromNowMs: number) {
  await page.evaluate((offset) => {
    const saved = JSON.parse(localStorage.getItem('mockerrank.attempt')!);
    localStorage.setItem(
      'mockerrank.attempt',
      JSON.stringify({ ...saved, deadline: Date.now() + offset }),
    );
    Storage.prototype.setItem = () => {};
  }, fromNowMs);
}

export async function setEditor(page: Page, code: string) {
  await page.locator('[data-testid=editor] .view-lines').first().click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  // Paste, as a person would. Typing it would trigger the editor's auto-indent on every line.
  await page.evaluate((text) => navigator.clipboard.writeText(text), code);
  await page.keyboard.press('Control+V');
  // Let the editor report the change.
  await page.waitForTimeout(200);
}

export async function selectLanguage(page: Page, language: LanguageId) {
  await page.getByLabel('Language').selectOption(language);
  await page.waitForTimeout(300);
}

// Waits for the run to start and finish, then returns the results panel text.
export async function waitForRun(page: Page) {
  const run = page.getByRole('button', { name: 'Run Code' });
  await run.isDisabled();
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find(
        // The button also shows its keyboard shortcut.
        (candidate) => candidate.textContent?.startsWith('Run Code'),
      );
      return button && !button.disabled;
    },
    undefined,
    { timeout: LONG_WAIT_MS, polling: 200 },
  );
  await page.waitForTimeout(100);
  return (await page.locator('main, body').first().textContent()) ?? '';
}

export async function runSolution(page: Page, language: LanguageId, code: string) {
  await selectLanguage(page, language);
  await setEditor(page, code);
  await page.getByRole('button', { name: 'Run Code' }).click();
  return waitForRun(page);
}

// An attempt in progress loads its questions before the page draws anything, which can finish after
// the browser reports the page as loaded.
export async function reloaded(page: Page) {
  await page.reload();
  await page.locator('#root > *').first().waitFor();
}

export async function openApp(page: Page) {
  await page.goto(URL);
  await page.locator('#root > *').first().waitFor();
}

// Leaves one finished attempt in the history, for sections that need some.
export async function finishQuickAttempt(page: Page) {
  await page.getByRole('button', { name: 'Start test' }).click();
  await page.getByRole('button', { name: 'Submit test' }).click();
  await page.getByRole('button', { name: 'Submit final answers' }).click();
  await page.getByRole('heading', { name: 'Test submitted' }).waitFor();
  await page.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  await page.getByRole('button', { name: 'Start a new test' }).click();
  await page.getByRole('button', { name: 'Start test' }).waitFor();
}

export async function newPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  return page;
}
