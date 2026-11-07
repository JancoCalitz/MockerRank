// Checks that a site built with CONTENT_PASSWORD holds no readable question content, so a
// mistake can never publish the bank in the open. The Pages workflow runs this before deploying.
//   node scripts/check-locked-build.ts [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const dir = process.argv[2] ?? 'dist';
const problems: string[] = [];

// Samples of each kind of content: question text, explanations, solutions, and large tests.
const yaml = (folder: string) =>
  readdirSync(join('content', folder))
    .filter((name) => name.endsWith('.yaml'))
    .map((name) => parse(readFileSync(join('content', folder, name), 'utf8')));
const mcqs = yaml('mcq').flat() as { stem: string; explanation: string }[];
const coding = yaml('coding') as {
  statement: string;
  languages: Record<string, { solution?: string }>;
}[];
const firstLine = (text: string) =>
  text
    .split('\n')
    .find((line) => line.trim().length > 30)
    ?.trim();
const samples = [
  ...mcqs.slice(0, 20).flatMap((mcq) => [firstLine(mcq.stem), firstLine(mcq.explanation)]),
  ...coding
    .slice(0, 20)
    .flatMap((problem) => [
      firstLine(problem.statement),
      ...Object.values(problem.languages).map((language) => firstLine(language.solution ?? '')),
    ]),
].filter((sample): sample is string => Boolean(sample));

const testsDir = join('content', 'tests');
const testSamples = existsSync(testsDir)
  ? readdirSync(testsDir)
      .slice(0, 10)
      .map((name) => readFileSync(join(testsDir, name), 'utf8').slice(0, 60))
      .filter((sample) => sample.trim().length >= 20)
  : [];

if (!existsSync(join(dir, 'content.bin'))) problems.push('content.bin is missing.');

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    // The language runtimes are third-party files with no question content, and are very large.
    if (name === 'runtimes') return [];
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

for (const path of files(dir)) {
  const text = readFileSync(path, 'latin1');
  const found = [...samples, ...testSamples].find((sample) => text.includes(sample));
  if (found) problems.push(`${path} contains readable content: "${found.slice(0, 50)}"`);
}

if (problems.length > 0) {
  console.error('The locked build is not safe to publish:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Locked build checked: ${samples.length + testSamples.length} samples, none readable.`);
