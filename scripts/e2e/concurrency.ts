import {
  type SectionContext,
  LONG_WAIT_MS,
  check,
  watch,
  goTo,
  setEditor,
  selectLanguage,
  openApp,
} from './harness.ts';

export async function concurrency({ browser }: SectionContext) {
  console.log('\nThree people at once');
  const people = await Promise.all(
    [0, 1, 2].map(async (index) => {
      const own = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        permissions: ['clipboard-read', 'clipboard-write'],
        serviceWorkers: 'block',
      });
      const person = await own.newPage();
      watch(person);
      await openApp(person);
      return { own, person, index };
    }),
  );
  const answers = await Promise.all(
    people.map(async ({ person, index }) => {
      await person.getByRole('combobox').selectOption(`mock-${index + 1}`);
      await person.getByRole('button', { name: 'Start test' }).click();
      await person.getByRole('radio').nth(index).check();
      await goTo(person, 19);
      await person.getByLabel('Language').waitFor({ timeout: 60000 });
      await selectLanguage(person, 'javascript');
      await person.getByRole('tab', { name: 'Custom input' }).click();
      return { index, body: `console.log("person-${index}");` };
    }),
  );
  // The clipboard is shared across browser profiles, so pasting at once could mix up the code.
  for (const { person, index } of people) {
    await person.bringToFront();
    await setEditor(person, answers[index]!.body);
  }
  const runs = await Promise.all(
    people.map(async ({ person, index }) => {
      await person.getByRole('button', { name: 'Run with custom input' }).click();
      await person
        .getByText(`person-${index}`, { exact: false })
        .last()
        .waitFor({ timeout: 60000 });
      return person.locator('section').nth(1).textContent();
    }),
  );
  check(
    'each person gets their own output',
    runs.every(
      (text, index) =>
        (text ?? '').includes(`person-${index}`) &&
        !(text ?? '').match(new RegExp(`person-[^${index}]`)),
    ),
  );
  const states = await Promise.all(
    people.map(({ person }) =>
      person.evaluate(() => {
        const attempt = JSON.parse(localStorage.getItem('mockerrank.attempt')!);
        return {
          exam: attempt.examId,
          selected: Object.values<{ selected: number[] }>(attempt.mcq)[0]!.selected[0],
          code: attempt.coding[Object.keys(attempt.coding)[0]!].code.javascript,
        };
      }),
    ),
  );
  check(
    'each person keeps their own exam, answers, and code',
    states.every(
      (state, index) =>
        state.exam === `mock-${index + 1}` &&
        typeof state.selected === 'number' &&
        state.code === answers[index]!.body,
    ),
    JSON.stringify(states).slice(0, 300),
  );
  const finished = await Promise.all(
    people.map(async ({ person }) => {
      await person.getByRole('button', { name: 'Submit test' }).click();
      await person.getByRole('button', { name: 'Submit final answers' }).click();
      await person.getByRole('heading', { name: 'Test submitted' }).waitFor();
      await person.getByRole('status').waitFor({ state: 'hidden', timeout: LONG_WAIT_MS });
      return person.evaluate(
        () => JSON.parse(localStorage.getItem('mockerrank.history') ?? '[]').length,
      );
    }),
  );
  check(
    'each person has only their own history',
    finished.every((count) => count === 1),
    finished.join(),
  );
  await Promise.all(people.map(({ own }) => own.close()));
}
