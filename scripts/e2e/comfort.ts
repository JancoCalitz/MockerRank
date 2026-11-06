import type { Page } from 'playwright-core';
import {
  type SectionContext,
  check,
  newPage,
  problemFile,
  reloaded,
  selectLanguage,
  setEditor,
  shot,
  waitForRun,
} from './harness.ts';

const listed = (page: Page) => page.getByRole('main').getByRole('listitem').count();

async function setting(page: Page, name: string) {
  await page.getByRole('button', { name: 'Theme' }).click();
  return page.getByRole('menuitemcheckbox', { name });
}

export async function comfort({ context }: SectionContext) {
  console.log('\nLanding page');
  const page = await newPage(context);
  const rules = page.getByText('The timer starts when you click Start');
  check('folds the rules away', !(await rules.isVisible()));
  check('Start comes first', await page.getByRole('button', { name: 'Start test' }).isVisible());
  await page.getByText('Before you start: the rules').click();
  check('opens the rules', await rules.isVisible());

  console.log('\nCoding gym filters');
  await page.getByRole('button', { name: 'Coding gym' }).click();
  const all = await listed(page);
  check(
    'shows how many are solved',
    await page.getByText(/\d+ of \d+ problems solved/).isVisible(),
  );
  await page.getByRole('searchbox', { name: 'Search' }).fill('quiet');
  check('searches by name', (await listed(page)) === 1);
  await page.getByRole('searchbox', { name: 'Search' }).fill('');
  await page.getByLabel('Difficulty').selectOption('hard');
  const hard = await listed(page);
  check('filters by difficulty', hard > 0 && hard < all);
  await page.getByLabel('Difficulty').selectOption('');
  await page.getByLabel('Topic').selectOption({ index: 1 });
  const topical = await listed(page);
  check('filters by topic', topical > 0 && topical < all);
  await page.getByLabel('Topic').selectOption('');
  await page.getByRole('searchbox', { name: 'Search' }).fill('no such problem');
  check(
    'says when nothing matches',
    await page.getByText('No problems match these filters.').isVisible(),
  );
  await page.getByRole('searchbox', { name: 'Search' }).fill('');
  await shot(page, 'gym-filters');

  console.log('\nBackground effects and sounds');
  await page.getByRole('button', { name: 'Full exam' }).click();
  const effects = await setting(page, 'Background effects');
  check('effects start on', (await effects.getAttribute('aria-checked')) === 'true');
  await effects.click();
  check(
    'turns effects off',
    (await page.evaluate(() => document.documentElement.dataset.effects)) === 'off',
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: '2020s · Aurora Glass', exact: true }).click();
  check('draws no moving background', (await page.locator('.theme-backdrop').count()) === 0);
  const sounds = await setting(page, 'Sounds');
  check('sounds start off', (await sounds.getAttribute('aria-checked')) === 'false');
  await sounds.click();
  check('turns sounds on', (await sounds.getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('Escape');
  // Count the tones started, as a test cannot hear them.
  await page.addInitScript(() => {
    const counted = window as unknown as { tones: number };
    counted.tones = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      counted.tones++;
      return create.call(this);
    };
  });
  await reloaded(page);
  check(
    'keeps the settings after a reload',
    (await page.evaluate(() => document.documentElement.dataset.effects)) === 'off' &&
      (await (await setting(page, 'Sounds')).getAttribute('aria-checked')) === 'true',
  );
  await shot(page, 'theme-menu-settings');
  await page.getByRole('menuitemcheckbox', { name: 'Background effects' }).click();
  check('turns effects back on', (await page.locator('.theme-backdrop').count()) === 1);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Coding gym' }).click();
  await page.getByRole('button', { name: /Quiet Stretch/ }).click();
  await page.getByLabel('Language').waitFor({ timeout: 30000 });
  await selectLanguage(page, 'javascript');
  await setEditor(page, problemFile('quiet-stretch').languages.javascript!.solution!);
  await page.getByRole('button', { name: 'Run Code' }).click();
  await waitForRun(page);
  // A blip when the run starts, then three notes when every test passes.
  check(
    'plays a blip and a chime when the tests pass',
    (await page.evaluate(() => (window as unknown as { tones: number }).tones)) === 4,
  );
}
