import { type SectionContext, check, reloaded, newPage } from './harness.ts';

export async function drill({ context }: SectionContext) {
  const later = await newPage(context);
  console.log('\nTopic drill');
  await later.getByRole('button', { name: 'Topic drill' }).click();
  check(
    'drill needs a topic',
    await later.getByRole('button', { name: 'Start drill' }).isDisabled(),
  );
  await later.getByLabel('Git').check();
  await later.getByLabel('Number of questions').selectOption('5');
  await later.getByRole('button', { name: 'Start drill' }).click();
  check('drill has no timer', (await later.getByRole('timer').count()) === 0);
  check(
    'drill starts with no answer shown',
    (await later.getByText('✓ Correct answer').count()) === 0,
  );
  await later
    .getByRole('radio')
    .first()
    .check()
    .catch(() => later.getByRole('checkbox').first().check());
  await later.getByRole('button', { name: 'Check answer' }).click();
  check(
    'drill shows the answer after checking',
    (await later.getByText('✓ Correct answer').count()) >= 1,
  );
  check(
    'drill shows the explanation',
    /(Correct|Not quite)/.test((await later.getByRole('status').textContent()) ?? ''),
  );
  await reloaded(later);
  await later.getByRole('button', { name: 'Topic drill' }).click();
  check(
    'a refresh keeps the drill',
    await later.getByRole('button', { name: 'Next question' }).isVisible(),
  );
  await later.getByRole('button', { name: 'Next question' }).click();
  for (let step = 1; step < 5; step++) {
    await later.getByRole('radio').first().check();
    await later.getByRole('button', { name: 'Check answer' }).click();
    await later.getByRole('button', { name: step === 4 ? 'See results' : 'Next question' }).click();
  }
  check(
    'drill reports a result',
    await later.getByRole('heading', { name: /You got \d of 5 right/ }).isVisible(),
  );
  await later.getByRole('button', { name: 'New drill' }).click();
  await later.getByRole('button', { name: 'Full exam' }).click();
}
