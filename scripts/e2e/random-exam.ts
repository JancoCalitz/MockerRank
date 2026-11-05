import { type SectionContext, check, reloaded, finishQuickAttempt, newPage } from './harness.ts';

export async function randomExam({ context }: SectionContext) {
  const later = await newPage(context);
  await finishQuickAttempt(later);
  console.log('\nRandom exam');
  await later.getByRole('combobox').selectOption('random');
  check(
    'shows a random exam',
    await later.getByRole('heading', { name: 'Random Exam' }).isVisible(),
  );
  await later.getByRole('button', { name: 'Start test' }).click();
  await later.getByRole('timer').waitFor();
  const randomAttempt = await later.evaluate(() => {
    const attempt = JSON.parse(localStorage.getItem('mockerrank.attempt')!);
    const history = JSON.parse(localStorage.getItem('mockerrank.history')!) as {
      questionIds?: string[];
    }[];
    return {
      exam: attempt.generatedExam as {
        id: string;
        mcq: string[];
        shortCoding: string;
        longCoding: string;
      },
      seen: history.flatMap((entry) => entry.questionIds ?? []),
    };
  });
  check('builds 18 multiple choice questions', randomAttempt.exam.mcq.length === 18);
  check(
    'avoids questions already seen',
    randomAttempt.seen.length > 0 &&
      !randomAttempt.exam.mcq.some((id) => randomAttempt.seen.includes(id)),
  );
  check(
    'avoids coding problems already seen',
    !randomAttempt.seen.includes(randomAttempt.exam.shortCoding),
  );
  check(
    'shows all 20 questions',
    (await later.getByRole('navigation', { name: 'Questions' }).getByRole('button').count()) === 20,
  );
  await reloaded(later);
  await later.getByRole('timer').waitFor();
  const reopenedId = await later.evaluate(
    () => JSON.parse(localStorage.getItem('mockerrank.attempt')!).generatedExam.id,
  );
  check('a refresh keeps the same random exam', reopenedId === randomAttempt.exam.id);
  await later.getByRole('button', { name: 'Submit test' }).click();
  await later.getByRole('button', { name: 'Submit final answers' }).click();
  await later.getByRole('heading', { name: 'Test submitted' }).waitFor();
  await later.getByRole('button', { name: 'View progress' }).click();
  await later
    .getByRole('button', { name: /^Review attempt/ })
    .first()
    .click();
  check(
    'reopens a past random exam',
    (await later.getByRole('heading', { name: 'Random Exam' }).count()) === 0 &&
      (await later.getByRole('heading', { name: 'Test submitted' }).isVisible()),
  );
  await later.getByRole('button', { name: 'Back to progress' }).click();
  await later.getByRole('button', { name: 'Back', exact: true }).click();
}
