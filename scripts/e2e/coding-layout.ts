import { type SectionContext, check, newPage, reloaded, shot } from './harness.ts';

export async function codingLayout({ context }: SectionContext) {
  console.log('\nResizable coding panes');
  const page = await newPage(context);
  const open = async () => {
    await page.getByRole('button', { name: 'Coding gym' }).click();
    await page.getByRole('button', { name: /Quiet Stretch/ }).click();
    await page.locator('.monaco-editor').first().waitFor({ timeout: 30000 });
  };
  await open();

  const sideBySide = page.getByRole('separator', { name: 'Resize the problem and the editor' });
  const stacked = page.getByRole('separator', { name: 'Resize the editor and the results' });
  const size = async (divider: typeof sideBySide) =>
    Number(await divider.getAttribute('aria-valuenow'));

  const before = await size(sideBySide);
  await sideBySide.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  check('the arrow keys widen the problem', (await size(sideBySide)) === before + 10);

  const results = await size(stacked);
  const box = (await stacked.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 5 });
  await page.mouse.up();
  check('dragging makes the results taller', (await size(stacked)) > results);
  await shot(page, 'coding-resized');

  const widened = await size(sideBySide);
  const taller = await size(stacked);
  await reloaded(page);
  await open();
  check(
    'keeps the sizes after a reload',
    (await size(sideBySide)) === widened && (await size(stacked)) === taller,
  );

  await page.getByRole('button', { name: 'Hide problem' }).click();
  check(
    'hides the problem',
    (await page.getByRole('heading', { name: 'Quiet Stretch' }).count()) === 0,
  );
  await page.getByRole('button', { name: 'Show problem' }).click();
  check(
    'shows the problem again',
    await page.getByRole('heading', { name: 'Quiet Stretch' }).isVisible(),
  );

  console.log('\nCoding on a narrow screen');
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(300);
  const problem = (await page.locator('#problem-panel').boundingBox())!;
  const editor = (await page.locator('[data-testid=editor]').boundingBox())!;
  check('stacks the problem above the editor', problem.y + problem.height <= editor.y + 1);
  check('the editor keeps a usable width', editor.width > 600);
  check('the editor keeps a usable height', editor.height > 250);
  await shot(page, 'coding-narrow');
}
