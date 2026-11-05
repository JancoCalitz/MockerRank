// Checks coding problems through the real browser runners: every language's starter code
// must compile, and every reference solution must pass all of its tests.
//
//   npm run content:validate:browser
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { parse } from 'yaml';
import { LANGUAGES, type LanguageId } from '../src/content/languages.ts';
import { codingSchema } from '../src/content/schema.ts';

const dir = join('content', 'coding');
const problems = readdirSync(dir)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => codingSchema.parse(parse(readFileSync(join(dir, name), 'utf8'))));

const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });

// Vite reloads the page the first time it prepares dependencies, so get that out of the way.
const warmup = await browser.newPage();
await warmup.goto('http://localhost:5197/');
await warmup
  .evaluate(async () => {
    const url = '/src/runner/judge.ts';
    await import(/* @vite-ignore */ url);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  })
  .catch(() => {});
await warmup.close();

const page = await browser.newPage();
await page.goto('http://localhost:5197/');

interface Outcome {
  compiled: boolean;
  compileOutput: string;
  verdicts: { verdict: string; stdout: string; stderr: string }[];
}

function judgeInPage(problem: unknown, language: string, code: string, tests: unknown[]) {
  return page.evaluate(
    async ({ problem, language, code, tests }): Promise<Outcome> => {
      const url = '/src/runner/judge.ts';
      const { judge } = await import(/* @vite-ignore */ url);
      const result = await judge(problem, language, code, tests);
      return {
        compiled: result.compiled,
        compileOutput: result.compileOutput,
        verdicts: result.tests,
      };
    },
    { problem, language, code, tests },
  );
}

const errors: string[] = [];
let checks = 0;

for (const problem of problems) {
  console.log(problem.id);
  for (const [id, entry] of Object.entries(problem.languages)) {
    const language = id as LanguageId;
    const label = LANGUAGES[language].label.padEnd(12);

    checks++;
    const starter = await judgeInPage(problem, language, entry.starter, []);
    if (!starter.compiled) {
      errors.push(
        `${problem.id}: ${label} starter code does not compile:\n${starter.compileOutput}`,
      );
    }

    if (!entry.solution) {
      console.log(`  ${label} starter ${starter.compiled ? 'ok' : 'FAILED'}, no solution`);
      continue;
    }
    checks++;
    const tests = [...problem.sampleTests, ...problem.hiddenTests];
    const solution = await judgeInPage(problem, language, entry.solution, tests);
    const failed = solution.verdicts.findIndex((test) => test.verdict !== 'accepted');
    if (!solution.compiled) {
      errors.push(`${problem.id}: ${label} solution does not compile:\n${solution.compileOutput}`);
    } else if (failed >= 0) {
      const test = solution.verdicts[failed]!;
      errors.push(
        `${problem.id}: ${label} solution failed test ${failed + 1}: ${test.verdict}\n  stdout: ${test.stdout.slice(0, 200)}\n  stderr: ${test.stderr.slice(0, 300)}`,
      );
    }
    const passed = solution.compiled && failed < 0;
    console.log(
      `  ${label} starter ${starter.compiled ? 'ok' : 'FAILED'}, solution ${passed ? `passed ${tests.length} tests` : 'FAILED'}`,
    );
  }
}

await browser.close();
await server.close();

if (errors.length > 0) {
  console.error(`\nFound ${errors.length} error(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`\nAll ${checks} browser checks passed.`);
process.exit(0);
