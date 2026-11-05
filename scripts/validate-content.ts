import { validateContent } from './lib/validate.ts';

const report = validateContent(process.argv[2] ?? 'content');
const { mcq, coding, exams, referenceRuns } = report.counts;

console.log(
  `Checked MCQs: ${mcq}, coding problems: ${coding}, exams: ${exams}, reference solution test runs: ${referenceRuns}.`,
);

if (report.skipped.length > 0) {
  console.log(
    `\nNot verified, because this machine cannot run them yet (${report.skipped.length}):`,
  );
  for (const item of report.skipped) console.log(`  ${item}`);
}

if (report.errors.length > 0) {
  console.error(`\nFound ${report.errors.length} error(s):`);
  for (const error of report.errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log('\nContent is valid.');
