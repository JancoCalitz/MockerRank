import { formatDuration } from '../../src/attempt/attempt.ts';
import { LANGUAGES, type LanguageId } from '../../src/content/languages.ts';
import {
  type SectionContext,
  LONG_WAIT_MS,
  short,
  long,
  check,
  watch,
  shot,
  tile,
  goTo,
  answeredCount,
  readTimer,
  sectionScores,
  setDeadline,
  setEditor,
  selectLanguage,
  waitForRun,
  runSolution,
  reloaded,
  openApp,
} from './harness.ts';

export async function attemptFlow({ context }: SectionContext) {
  console.log('\nLanding page');
  const page = await context.newPage();
  watch(page);
  await openApp(page);
  check('shows the rules', await page.getByText('90 minutes').isVisible());
  await shot(page, '1-landing');
  await page.getByRole('button', { name: 'Start test' }).click();
  check('starts the timer', (await readTimer(page)) > 89 * 60);

  console.log('\nMultiple choice answers');
  await page.getByRole('radio').nth(1).check();
  check('marks the question answered', (await answeredCount(page)) === 1);
  await page.getByRole('button', { name: 'Clear selection' }).click();
  check('clears a selection', (await answeredCount(page)) === 0);
  await page.getByRole('radio').nth(1).check();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Flag for review' }).click();
  check(
    'flags a question',
    await tile(page, 2)
      .getAttribute('aria-label')
      .then((l) => /flagged/.test(l ?? '')),
  );

  for (let number = 2; number <= 18; number++) {
    await goTo(page, number);
    const radios = page.getByRole('radio');
    if ((await radios.count()) > 0) {
      await radios.nth(number % 4).check();
    } else {
      await page.getByRole('checkbox').nth(0).check();
      await page.getByRole('checkbox').nth(2).check();
      const checked = await page
        .getByRole('checkbox')
        .evaluateAll((boxes) => boxes.map((box) => (box as HTMLInputElement).checked));
      check(
        'selects several answers on a multi-select question',
        checked.join() === 'true,false,true,false',
      );
    }
  }
  check('answers all 18 multiple choice questions', (await answeredCount(page)) === 18);
  await goTo(page, 13);
  await shot(page, '2-multiple-choice');

  console.log('\nTimer');
  const ticking = await readTimer(page);
  for (const number of [14, 15, 16, 13, 14, 13]) {
    await goTo(page, number);
    await page.waitForTimeout(400);
  }
  check('keeps counting while moving between questions', (await readTimer(page)) < ticking);
  const inlineCode = await page
    .locator('.prose code')
    .first()
    .evaluate((element) => getComputedStyle(element, '::before').content);
  check('does not add backticks around inline code', inlineCode === 'none', inlineCode);

  console.log('\nRefreshing and closing the tab');
  const before = await readTimer(page);
  await page.waitForTimeout(1500);
  await reloaded(page);
  await page.getByRole('timer').waitFor();
  const after = await readTimer(page);
  check(
    'refresh does not reset the timer',
    after < before && after > before - 30,
    `${before} -> ${after}`,
  );
  check('refresh keeps the answers', (await answeredCount(page)) === 18);
  check(
    'refresh returns to the same question',
    (await tile(page, 13).getAttribute('aria-current')) === 'true',
  );
  check(
    'refresh keeps the selected option',
    await page
      .getByRole('radio')
      .nth(13 % 4)
      .isChecked(),
  );

  await page.close();
  const reopened = await context.newPage();
  watch(reopened);
  await openApp(reopened);
  await reopened.getByRole('timer').waitFor();
  check('closing the tab keeps the answers', (await answeredCount(reopened)) === 18);
  const afterClose = await readTimer(reopened);
  check('closing the tab does not reset the timer', afterClose <= after);

  console.log('\nCoding: every language, from the production build');
  await goTo(reopened, 19);
  await reopened.getByLabel('Language').waitFor({ timeout: 30000 });
  for (const [id, entry] of Object.entries(short.languages)) {
    const language = id as LanguageId;
    const text = await runSolution(reopened, language, entry.solution!);
    check(
      `${LANGUAGES[language].label} passes the sample tests`,
      text.includes('Sample tests: 2 of 2 tests passed'),
      text.slice(-300),
    );
  }
  await shot(reopened, '3-coding');

  console.log('\nCoding: function-style problem');
  await goTo(reopened, 20);
  await reopened.getByLabel('Language').waitFor();
  for (const id of ['java', 'python'] as const) {
    const text = await runSolution(reopened, id, long.languages[id]!.solution!);
    check(
      `${LANGUAGES[id].label} passes through its harness`,
      text.includes('Sample tests: 2 of 2 tests passed'),
      text.slice(-300),
    );
  }

  console.log('\nCoding: results and states');
  await goTo(reopened, 19);
  await selectLanguage(reopened, 'javascript');
  const editorText = await reopened
    .locator('[data-testid=editor] .view-lines')
    .first()
    .textContent();
  check(
    'each language keeps its own code',
    (editorText ?? '').includes('counts'),
    editorText ?? '',
  );

  const results = reopened.locator('section').nth(1);
  await setEditor(reopened, 'console.log("nope");');
  await reopened.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(reopened);
  check('shows a wrong answer', await results.getByText('Wrong Answer').first().isVisible());
  check(
    'shows the program output for a sample',
    (await results.textContent())?.includes('nope') ?? false,
  );

  await setEditor(reopened, 'const x = ;');
  await reopened.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(reopened);
  check('shows a compile error', await results.getByText('Compilation Error').isVisible());

  await setEditor(reopened, short.languages.javascript!.solution!);
  await reopened.keyboard.press('Control+Shift+Enter');
  await waitForRun(reopened);
  const submitted = (await results.textContent()) ?? '';
  check(
    'the shortcut submits all tests',
    submitted.includes('Submission: 8 of 8 tests passed'),
    submitted.slice(0, 200),
  );
  check('hidden test data stays hidden', !submitted.includes('X1'));
  check('hidden tests still show a result', submitted.includes('Hidden test 1'));

  await reopened.getByRole('button', { name: 'Show hidden tests' }).click();
  const revealed = (await results.textContent()) ?? '';
  check('the button reveals hidden tests', revealed.includes('X1'));
  check('revealing marks the attempt as assisted', revealed.includes('marked as assisted'));
  await shot(reopened, '4-hidden-tests');
  await reopened.getByRole('button', { name: 'Hide hidden tests' }).click();
  const hiddenAgain = (await results.textContent()) ?? '';
  check('the button hides them again', !hiddenAgain.includes('X1'));
  check('the attempt stays marked as assisted', hiddenAgain.includes('marked as assisted'));

  await reopened.getByRole('tab', { name: 'Custom input' }).click();
  await reopened.getByLabel('Input').fill('2\nab\nab\n');
  await reopened.getByRole('button', { name: 'Run with custom input' }).click();
  await reopened.getByText('ab 2').waitFor({ timeout: 30000 });
  check('runs with custom input', true);
  await reopened.getByRole('tab', { name: 'Test results' }).click();

  await reopened.getByLabel('Font size').selectOption('18');
  await reopened.getByLabel('Theme').selectOption('vs-dark');
  check('changes editor settings', (await reopened.locator('.monaco-editor.vs-dark').count()) > 0);

  console.log('\nCode survives a refresh');
  await reloaded(reopened);
  await reopened.getByLabel('Language').waitFor({ timeout: 30000 });
  await reopened.locator('[data-testid=editor] .view-lines').first().waitFor();
  const restored = await reopened.locator('[data-testid=editor] .view-lines').first().textContent();
  check('keeps the code', (restored ?? '').includes('counts'), restored ?? '');
  check('keeps the results', ((await results.textContent()) ?? '').includes('8 of 8 tests passed'));
  check(
    'keeps the editor settings',
    (await reopened.locator('.monaco-editor.vs-dark').count()) > 0,
  );
  check('keeps all 20 questions answered', (await answeredCount(reopened)) === 20);

  console.log('\nFinal submit');
  await reopened.getByRole('button', { name: 'Submit test' }).click();
  const dialog = await reopened.getByRole('dialog').textContent();
  check(
    'confirms with the unanswered and flagged counts',
    (dialog ?? '').includes('0 unanswered and 1 flagged'),
    dialog ?? '',
  );
  await shot(reopened, '5-confirm');
  await reopened.getByRole('button', { name: 'Submit final answers' }).click();
  check(
    'finishes the attempt',
    await reopened.getByRole('heading', { name: 'Test submitted' }).isVisible(),
  );
  check(
    'reports what was answered',
    await reopened.getByText('You answered 20 of 20 questions.').isVisible(),
  );
  await reloaded(reopened);
  check(
    'stays finished after a refresh',
    await reopened.getByRole('heading', { name: 'Test submitted' }).isVisible(),
  );

  console.log('\nScoring');
  // Question 20 was run but never submitted, so finishing the attempt has to judge it.
  await reopened.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  const scored = (await sectionScores(reopened)).join();
  check('judges code that was never submitted', scored.includes('Long coding100%'), scored);
  check('scores the submitted code', scored.includes('Short coding100%'), scored);
  check(
    'still marks the attempt as assisted',
    await reopened.getByText('marked as assisted').isVisible(),
  );
  const spent = await reopened.evaluate(
    () => JSON.parse(localStorage.getItem('mockerrank.attempt')!).timeSpentMs['busiest-badge'],
  );
  check('records the time spent on a question', spent >= 5000, String(spent));
  check(
    'shows the time spent on a question',
    (
      (await reopened.getByRole('listitem').filter({ hasText: 'Busiest Badge' }).textContent()) ??
      ''
    ).includes(formatDuration(spent)),
    formatDuration(spent),
  );
  await reopened.getByText('Busiest Badge').click();
  const review =
    (await reopened.getByRole('listitem').filter({ hasText: 'Busiest Badge' }).textContent()) ?? '';
  check('shows hidden test data after the attempt', review.includes('X1'));
  check('shows the editorial', review.includes('Editorial'));
  await reopened.getByRole('button', { name: 'Hide hidden test data' }).click();
  check(
    'can hide hidden test data in the review',
    !(
      (await reopened.getByRole('listitem').filter({ hasText: 'Busiest Badge' }).textContent()) ??
      ''
    ).includes('X1'),
  );
  await shot(reopened, '6-results');

  console.log('\nExpiry');
  await reopened.getByRole('button', { name: 'Start a new test' }).click();
  await reopened.getByRole('button', { name: 'Start test' }).click();
  await reopened.getByRole('radio').first().check();
  await goTo(reopened, 19);
  await reopened.getByLabel('Language').waitFor({ timeout: 30000 });
  await selectLanguage(reopened, 'javascript');
  await setEditor(reopened, short.languages.javascript!.solution!);
  await setDeadline(reopened, 3000);
  await reloaded(reopened);
  await reopened.getByRole('timer').waitFor();
  check('still running just before the deadline', await reopened.getByRole('timer').isVisible());
  await reopened.getByRole('heading', { name: 'Time is up' }).waitFor({ timeout: 8000 });
  check('submits automatically at the deadline', true);
  check(
    'keeps the answers from the expired attempt',
    await reopened.getByText('You answered 2 of 20 questions.').isVisible(),
  );
  await reopened.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  const expiredScores = (await sectionScores(reopened)).join();
  check(
    'judges unsubmitted code when time runs out',
    expiredScores.includes('Short coding100%'),
    expiredScores,
  );

  await reopened.getByRole('button', { name: 'Start a new test' }).click();
  await reopened.getByRole('button', { name: 'Start test' }).click();
  await setDeadline(reopened, -1000);
  await reopened.close();
  const later = await context.newPage();
  watch(later);
  await openApp(later);
  check(
    'an attempt that ran out while closed is finished on return',
    await later.getByRole('heading', { name: 'Time is up' }).isVisible(),
  );

  console.log('\nProgress');
  await later.getByRole('button', { name: 'View progress' }).click();
  await later.getByRole('heading', { name: 'Your progress' }).waitFor();
  check(
    'lists every attempt',
    (await later.getByRole('button', { name: /^Review attempt/ }).count()) === 3,
  );
  check(
    'explains the assisted marker',
    await later.getByText('A hollow dot is an assisted attempt.').isVisible(),
  );
  const dots = later.getByRole('img', { name: /^Attempt \d/ });
  check('plots every attempt', (await dots.count()) === 3);
  await dots.nth(1).focus();
  check('shows a value on keyboard focus', await later.getByText(/\d+% Attempt 2/).isVisible());
  await later.setViewportSize({ width: 1366, height: 1100 });
  await shot(later, '7-progress');
  await later.getByRole('button', { name: 'Review attempt 1' }).click();
  check(
    'reopens a past attempt',
    await later.getByRole('heading', { name: 'Test submitted' }).isVisible(),
  );
  check(
    'a past attempt keeps its score',
    (await sectionScores(later)).join().includes('Long coding100%'),
  );
  await later.getByRole('button', { name: 'Back to progress' }).click();
  await reloaded(later);
  check(
    'a refresh keeps the progress',
    await later.getByRole('button', { name: 'View progress' }).isVisible(),
  );
}
