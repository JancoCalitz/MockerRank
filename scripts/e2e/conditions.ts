import {
  type SectionContext,
  LONG_WAIT_MS,
  check,
  shot,
  goTo,
  reloaded,
  newPage,
} from './harness.ts';

export async function conditions({ context }: SectionContext) {
  const later = await newPage(context);
  console.log('\nTest conditions');
  await later.getByLabel('Require full screen').check();
  await later.getByRole('button', { name: 'Start test' }).click();
  await later.getByRole('timer').waitFor();

  const inFullscreen = () => later.evaluate(() => Boolean(document.fullscreenElement));
  check('enters full screen when required', await inFullscreen());
  const warning = later.getByText('You have left full screen or the test');
  await later.evaluate(() => document.exitFullscreen());
  await later.getByRole('button', { name: 'Return to full screen' }).waitFor();
  check('offers a way back after leaving full screen', true);
  check('does not warn after one violation', (await warning.count()) === 0);
  await later.getByRole('button', { name: 'Return to full screen' }).click();
  await later.getByRole('button', { name: 'Return to full screen' }).waitFor({ state: 'hidden' });
  check('returns to full screen', await inFullscreen());
  await later.evaluate(() => document.exitFullscreen());
  await later.getByRole('button', { name: 'Return to full screen' }).waitFor();
  check('warns after the set number of violations', await warning.isVisible());
  await shot(later, '9-warning');

  // Automated browsers keep the page focused, so this reports what a tab switch reports. A
  // real tab switch was tested separately against the production build, by driving Edge directly.
  await later.evaluate(async () => {
    const setVisibility = (value: string) => {
      Object.defineProperty(document, 'visibilityState', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.dispatchEvent(new Event('blur'));
    setVisibility('hidden');
    await new Promise((resolve) => setTimeout(resolve, 150));
    setVisibility('visible');
    window.dispatchEvent(new Event('focus'));
  });
  await later
    .getByRole('button', { name: 'Clear selection' })
    .click({ button: 'right', force: true });
  await later.setViewportSize({ width: 1300, height: 1000 });
  await later.waitForTimeout(800);

  await goTo(later, 19);
  await later.getByLabel('Language').waitFor({ timeout: 30000 });
  await later.locator('[data-testid=editor] .view-lines').first().click();
  await later.keyboard.press('Control+A');
  await later.keyboard.press('Control+C');
  await later.evaluate(() => navigator.clipboard.writeText('// pasted'));
  await later.keyboard.press('Control+End');
  await later.keyboard.press('Control+V');
  await later.waitForTimeout(200);
  await reloaded(later);
  await later.getByRole('timer').waitFor();
  await later.getByRole('button', { name: 'Return to full screen' }).waitFor();
  check('a refresh keeps the warning', await warning.isVisible());

  await later.getByRole('button', { name: 'Submit test' }).click();
  await later.getByRole('button', { name: 'Submit final answers' }).click();
  await later.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
  const conditions = later.getByRole('table', { name: 'Test conditions' });
  const conditionValue = async (name: string) =>
    (await conditions
      .getByRole('row', { name: new RegExp(`^${name}`) })
      .getByRole('cell')
      .textContent()) ?? '';
  check(
    'reports leaving once per tab switch',
    (await conditionValue('Times you left the test')) === '1',
  );
  check('reports time away', (await conditionValue('Time away')) !== '');
  check(
    'reports leaving full screen',
    (await conditionValue('Times you left full screen')) === '2',
  );
  check(
    'reports a copy from the editor',
    (await conditionValue('Copies from the editor')) === '1',
    await conditionValue('Copies from the editor'),
  );
  check(
    'reports a paste into the editor',
    (await conditionValue('Pastes into the editor')) === '1',
    await conditionValue('Pastes into the editor'),
  );
  check(
    'reports a right-click',
    (await conditionValue('Right-clicks')) === '1',
    await conditionValue('Right-clicks'),
  );
  check(
    'reports a resize once',
    (await conditionValue('Window resizes')) === '1',
    await conditionValue('Window resizes'),
  );
  await later.getByText('Timeline of the latest events').click();
  check('shows a timeline', await later.getByText(/Tab hidden, on question 1/).isVisible());
  await later.getByRole('heading', { name: 'Test conditions' }).scrollIntoViewIfNeeded();
  await shot(later, '10-conditions');
  const saved = await later.evaluate(() => localStorage.getItem('mockerrank.attempt') ?? '');
  check(
    'never stores what was copied or pasted',
    !saved.includes('"text"') && !/clipboard/i.test(saved),
  );
  await later.getByRole('button', { name: 'Start a new test' }).click();
}
