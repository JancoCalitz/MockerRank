import type { Page } from 'playwright-core';
import { DEFAULT_THEME_ID, THEMES } from '../../src/themes/index.ts';
import { type SectionContext, URL, check, goTo, newPage, reloaded, shot } from './harness.ts';

const themeOf = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const isCalm = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.calm === 'true');

async function chooseTheme(page: Page, label: string) {
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: label, exact: true }).click();
}

// Whether every item of the open theme menu is drawn on top, not hidden under the page.
async function menuOnTop(page: Page) {
  await page.getByRole('button', { name: 'Theme' }).click();
  const onTop = await page.getByRole('menuitemradio').evaluateAll((items) =>
    items.every((item) => {
      const box = item.getBoundingClientRect();
      const y = box.top + box.height / 2;
      // Across the whole width, as the page may cover only part of the menu.
      return [0.05, 0.5, 0.95].every((across) => {
        const hit = document.elementFromPoint(box.left + box.width * across, y);
        return hit !== null && item.contains(hit);
      });
    }),
  );
  await page.keyboard.press('Escape');
  return onTop;
}

// Screenshots of one screen in every theme, for looking over by eye.
async function shootEveryTheme(page: Page, screen: string) {
  for (const theme of THEMES) {
    await chooseTheme(page, theme.label);
    // Let a theme's entrance animation finish first.
    await page.waitForTimeout(500);
    await shot(page, `theme-${theme.id}-${screen}`);
  }
}

export async function themes({ context }: SectionContext) {
  console.log('\nThemes');
  const page = await newPage(context);
  check('starts with the default theme', (await themeOf(page)) === DEFAULT_THEME_ID);

  const shown: string[] = [];
  for (const theme of THEMES) {
    await chooseTheme(page, theme.label);
    if ((await themeOf(page)) === theme.id) shown.push(theme.id);
    await page.waitForTimeout(500);
    await shot(page, `theme-${theme.id}-landing`);
  }
  check('applies every theme', shown.length === THEMES.length, `applied ${shown.join(', ')}`);

  const hidden: string[] = [];
  for (const theme of THEMES) {
    await chooseTheme(page, theme.label);
    if (!(await menuOnTop(page))) hidden.push(theme.id);
  }
  check(
    'the theme menu opens over the page',
    hidden.length === 0,
    `hidden in ${hidden.join(', ')}`,
  );

  await chooseTheme(page, 'Classic');
  await reloaded(page);
  check('keeps the theme after a reload', (await themeOf(page)) === 'classic');

  await page.getByRole('button', { name: 'Theme' }).click();
  check(
    'marks the current theme',
    (await page.getByRole('menuitemradio', { checked: true }).textContent())?.includes('Classic') ??
      false,
  );
  await page.keyboard.press('Escape');
  check('closes the menu with Escape', (await page.getByRole('menu').count()) === 0);
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check('chooses a theme with the keyboard', (await themeOf(page)) === THEMES[1]!.id);

  console.log('\nThemes during a test');
  check('animates outside a test', !(await isCalm(page)));
  await page.getByRole('button', { name: 'Start test' }).click();
  await page.getByRole('timer').waitFor();
  check('is calm during a test', await isCalm(page));
  await chooseTheme(page, 'Classic');
  check('changes theme during a test', (await themeOf(page)) === 'classic');
  await shootEveryTheme(page, 'exam');
  const hiddenInTest: string[] = [];
  for (const theme of THEMES) {
    await chooseTheme(page, theme.label);
    if (!(await menuOnTop(page))) hiddenInTest.push(theme.id);
  }
  check(
    'the theme menu opens over a test',
    hiddenInTest.length === 0,
    `hidden in ${hiddenInTest.join(', ')}`,
  );
  await goTo(page, 19);
  await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
  await shootEveryTheme(page, 'coding');
  await page.getByRole('button', { name: 'Submit test' }).click();
  await page.getByRole('button', { name: 'Submit final answers' }).click();
  await page.getByRole('heading', { name: 'Test submitted' }).waitFor();
  check('is no longer calm after the test', !(await isCalm(page)));
  await page.getByRole('button', { name: 'Start a new test' }).click();
  await page
    .getByRole('navigation', { name: 'Practice modes' })
    .getByRole('button', { name: 'Progress' })
    .click();
  await shootEveryTheme(page, 'progress');

  console.log('\nCode editor themes');
  await chooseTheme(page, 'Classic');
  await page.getByRole('button', { name: 'Coding gym' }).click();
  await page.getByRole('button', { name: /Quiet Stretch/ }).click();
  await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
  check('is calm on a gym problem', await isCalm(page));
  check('editor matches a light theme', (await page.locator('.monaco-editor.vs').count()) > 0);
  await chooseTheme(page, THEMES.find(({ id }) => id === 'retro80s')!.label);
  check(
    'editor follows a theme change',
    (await page.locator('.monaco-editor.vs-dark').count()) > 0,
  );
}

// The 1990s screensaver starts after 30 seconds without input, stops on input, and never covers
// a test. The page's clock is faked, so this does not wait in real time.
export async function screensaver({ context }: SectionContext) {
  console.log('\nScreensaver');
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(URL);
  await page.evaluate(() => localStorage.setItem('mockerrank.theme', 'desktop90s'));
  await reloaded(page);
  const saver = page.locator('.desktop-screensaver');
  await page.clock.runFor(31_000);
  check('starts after a while without input', await saver.isVisible());
  await page.mouse.move(200, 200);
  check('stops on input', (await saver.count()) === 0);
  await page.getByRole('button', { name: 'Start test' }).click();
  await page.getByRole('timer').waitFor();
  await page.clock.runFor(61_000);
  check('never starts during a test', (await saver.count()) === 0);
}
