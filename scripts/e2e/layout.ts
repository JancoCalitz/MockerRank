import { type SectionContext, check, newPage } from './harness.ts';

export async function layout({ context }: SectionContext) {
  console.log('\nTop bar');
  const page = await newPage(context);
  const modes = page.getByRole('navigation', { name: 'Practice modes' });
  await modes.getByRole('button', { name: 'Progress' }).click();
  check(
    'opens progress from the top bar',
    await page.getByRole('heading', { name: 'Your progress' }).isVisible(),
  );
  check(
    'marks the current mode',
    (await modes.getByRole('button', { name: 'Progress' }).getAttribute('aria-current')) === 'page',
  );
  await page.getByRole('button', { name: 'MockerRank' }).click();
  check('the logo leads home', await page.getByRole('button', { name: 'Start test' }).isVisible());

  console.log('\nNarrow screens');
  await page.setViewportSize({ width: 600, height: 900 });
  check('folds the modes into a menu', !(await modes.isVisible()));
  await page.getByRole('button', { name: 'Menu' }).click();
  await page
    .getByRole('navigation', { name: 'Practice modes' })
    .getByRole('button', { name: 'Coding gym' })
    .click();
  check(
    'the menu opens a mode',
    await page.getByRole('heading', { name: 'Coding gym' }).isVisible(),
  );
  check(
    'the page fits the screen',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
}
