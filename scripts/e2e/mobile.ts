import type { Browser, Page } from 'playwright-core';
import { THEMES } from '../../src/themes/index.ts';
import {
  type SectionContext,
  URL,
  check,
  finishQuickAttempt,
  goTo,
  shot,
  watch,
} from './harness.ts';

// Phones and tablets, with touch, as people will open the app on them.
const DEVICES = [
  { name: 'phone-small', width: 360, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

// Whatever sticks out past the right edge of the screen, outside its own scrolling box.
function overflowing(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrolls = (element: Element | null): boolean => {
      for (let node = element?.parentElement; node; node = node.parentElement) {
        const { overflowX } = getComputedStyle(node);
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true;
      }
      return false;
    };
    const wide = [...document.querySelectorAll('body *')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.right > width + 1 && !scrolls(element);
    });
    return {
      pageScrolls: document.documentElement.scrollWidth > width + 1,
      examples: wide
        .slice(0, 4)
        .map(
          (element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}`,
        ),
    };
  });
}

// Taps on buttons and links smaller than a finger, which is about 44 by 44 pixels.
function smallTargets(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        'button, a, [role=separator], input[type=checkbox], input[type=radio]',
      ),
    ]
      .filter((element) => {
        // A link inside a sentence is exempt, as in the accessibility guidelines.
        if (element.tagName === 'A' && element.closest('p')) return false;
        // A checkbox or radio is tapped through its label, which is the real target.
        const target = element.matches('input') ? (element.closest('label') ?? element) : element;
        const box = target.getBoundingClientRect();
        if (box.width === 0 || getComputedStyle(element).visibility === 'hidden') return false;
        return box.height < 32 || box.width < 32;
      })
      .map((element) =>
        (element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 24),
      )
      .slice(0, 6),
  );
}

async function openMode(page: Page, name: string) {
  const mode = page
    .getByRole('navigation', { name: 'Practice modes' })
    .getByRole('button', { name });
  if (!(await mode.isVisible())) await page.getByRole('button', { name: 'Menu' }).click();
  await mode.click();
}

async function setTheme(page: Page, id: string) {
  await page.evaluate((theme) => localStorage.setItem('mockerrank.theme', theme), id);
  await page.reload();
  await page.locator('#root > *').first().waitFor();
}

async function newDevicePage(browser: Browser, device: (typeof DEVICES)[number]) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    hasTouch: true,
    isMobile: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  watch(page);
  await page.goto(URL);
  await page.locator('#root > *').first().waitFor();
  return { context, page };
}

export async function mobile({ browser }: SectionContext) {
  for (const device of DEVICES) {
    console.log(`\nScreens on a ${device.name} (${device.width} px)`);
    const { context, page } = await newDevicePage(browser, device);
    await finishQuickAttempt(page);
    const screens: [string, () => Promise<void>][] = [
      ['landing', async () => {}],
      [
        'menu',
        async () => {
          const menu = page.getByRole('button', { name: 'Menu' });
          if (await menu.isVisible()) await menu.click();
        },
      ],
      ['drill', () => openMode(page, 'Topic drill')],
      ['gym', () => openMode(page, 'Coding gym')],
      [
        'gym-problem',
        async () => {
          await page.getByRole('button', { name: /Quiet Stretch/ }).click();
          await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
        },
      ],
      [
        'progress',
        async () => {
          await page.getByRole('button', { name: 'All problems' }).click();
          await openMode(page, 'Progress');
        },
      ],
      ['data', () => openMode(page, 'Packs and backups')],
      [
        'exam',
        async () => {
          await openMode(page, 'Full exam');
          await page.getByRole('button', { name: 'Start test' }).click();
          await page.getByRole('timer').waitFor();
        },
      ],
      [
        'exam-coding',
        async () => {
          await goTo(page, 19);
          await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
        },
      ],
      [
        'results',
        async () => {
          await page.getByRole('button', { name: 'Submit test' }).click();
          await page.getByRole('button', { name: 'Submit final answers' }).click();
          await page.getByRole('heading', { name: 'Test submitted' }).waitFor();
        },
      ],
    ];
    for (const [name, open] of screens) {
      await open();
      await page.waitForTimeout(300);
      const { pageScrolls, examples } = await overflowing(page);
      check(`${name} fits the screen`, !pageScrolls && examples.length === 0, examples.join(', '));
      if (device.name !== 'tablet') {
        const small = await smallTargets(page);
        check(`${name} has finger-sized targets`, small.length === 0, small.join(' | '));
      }
      await shot(page, `mobile-${device.name}-${name}`);
    }
    await context.close();
  }

  console.log('\nEvery theme on a phone');
  const { context, page } = await newDevicePage(browser, DEVICES[1]!);
  for (const theme of THEMES) {
    await setTheme(page, theme.id);
    const landing = await overflowing(page);
    await shot(page, `mobile-landing-${theme.id}`);
    await page.getByRole('button', { name: 'Start test' }).click();
    await page.getByRole('timer').waitFor();
    const exam = await overflowing(page);
    await shot(page, `mobile-theme-${theme.id}`);
    await page.getByRole('button', { name: 'Submit test' }).click();
    await page.getByRole('button', { name: 'Submit final answers' }).click();
    await page.getByRole('heading', { name: 'Test submitted' }).waitFor();
    await page.getByRole('button', { name: 'Start a new test' }).click();
    check(
      `${theme.label} fits a phone`,
      !landing.pageScrolls &&
        !exam.pageScrolls &&
        landing.examples.length + exam.examples.length === 0,
      [...landing.examples, ...exam.examples].join(', '),
    );
  }
  await context.close();
}
