import type { Page } from 'playwright-core';
import {
  type SectionContext,
  answeredCount,
  check,
  goTo,
  newPage,
  reloaded,
  setDeadline,
  shot,
  tile,
} from './harness.ts';

const label = async (page: Page, number: number) =>
  (await tile(page, number).getAttribute('aria-label')) ?? '';

export async function examExperience({ context }: SectionContext) {
  console.log('\nQuestion navigator');
  const page = await newPage(context);
  await page.getByRole('button', { name: 'Start test' }).click();
  await page.getByRole('timer').waitFor();
  const questions = page.getByRole('navigation', { name: 'Questions' });
  check(
    'groups multiple choice and coding',
    (await questions.getByText('Multiple choice').isVisible()) &&
      (await questions.getByText('Coding', { exact: true }).isVisible()),
  );
  check('explains the tile styles', await page.getByRole('list', { name: 'Key' }).isVisible());

  console.log('\nKeyboard shortcuts');
  await page.waitForTimeout(1200);
  await page.keyboard.press('b');
  check('a letter chooses an answer', (await answeredCount(page)) === 1);
  await page.keyboard.press('ArrowRight');
  check('the right arrow moves on', (await tile(page, 2).getAttribute('aria-current')) === 'true');
  await page.keyboard.press('f');
  check('F flags the question', (await label(page, 2)).includes('flagged'));
  await page.keyboard.press('3');
  check('a number chooses an answer', (await answeredCount(page)) === 2);
  await page.keyboard.press('ArrowLeft');
  check('the left arrow moves back', (await tile(page, 1).getAttribute('aria-current')) === 'true');
  await page.keyboard.press('?');
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  check('? lists the shortcuts', await dialog.isVisible());
  await shot(page, 'exam-shortcuts');
  await page.keyboard.press('Escape');
  check('Escape closes the list', (await dialog.count()) === 0);

  await goTo(page, 3);
  await page.waitForTimeout(1200);
  await goTo(page, 1);
  check('marks a question seen but not answered', (await label(page, 3)).includes(', seen'));
  check('a question not opened is not seen', !(await label(page, 4)).includes('seen'));
  await shot(page, 'exam-navigator');

  await goTo(page, 19);
  await page.locator('[data-testid=editor] .view-lines').first().click();
  await page.keyboard.type('f');
  check('typing in the editor is not a shortcut', !(await label(page, 19)).includes('flagged'));
  check(
    'Run Code shows its shortcut',
    (await page.getByRole('button', { name: 'Run Code' }).getAttribute('aria-keyshortcuts')) ===
      'Control+Enter',
  );

  console.log('\nTime warnings');
  await setDeadline(page, 15 * 60_000 - 3000);
  await reloaded(page);
  await page.getByRole('timer').waitFor();
  check(
    'warns at 15 minutes left',
    await page.getByText('15 minutes left. The test submits itself when time is up.').isVisible(),
  );
  await shot(page, 'exam-time-warning');
  await page.waitForTimeout(12_000);
  check(
    'the warning goes away',
    (await page.getByText('15 minutes left.', { exact: false }).count()) === 0,
  );
}
