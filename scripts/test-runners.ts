// Phase 3 acceptance test: runs real programs through every language runtime in a real
// browser. For each language: correct code passes, wrong code fails, an endless loop hits
// the time limit, a memory hog hits the memory limit, and a syntax error is readable.
//
//   npm run test:runners            all languages
//   npm run test:runners java cpp   only those languages
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

interface Program {
  good: string;
  wrong: string;
  loop: string;
  hog: string;
  syntax: string;
  objectHog?: string;
}

const PROGRAMS: Record<string, Program> = {
  javascript: {
    good: `const n = Number(require('fs').readFileSync(0, 'utf8')); console.log(n * 2);`,
    wrong: `const n = Number(require('fs').readFileSync(0, 'utf8')); console.log(n * 3);`,
    loop: `while (true) {}`,
    hog: `const keep = []; while (true) { const a = new Uint8Array(1 << 20); a.fill(1); keep.push(a); }`,
    syntax: `const x = ;`,
    objectHog: `const keep = []; while (true) { keep.push(new Array(1 << 17).fill({})); }`,
  },
  typescript: {
    good: `import { readFileSync } from 'node:fs'; const n: number = Number(readFileSync(0, 'utf8')); console.log(n * 2);`,
    wrong: `import { readFileSync } from 'node:fs'; const n: number = Number(readFileSync(0, 'utf8')); console.log(n * 3);`,
    loop: `while (true) {}`,
    hog: `const keep: Uint8Array[] = []; while (true) { const a = new Uint8Array(1 << 20); a.fill(1); keep.push(a); }`,
    syntax: `const x: number = ;`,
  },
  python: {
    good: `print(int(input()) * 2)`,
    wrong: `print(int(input()) * 3)`,
    loop: `while True:\n    pass`,
    hog: `keep = []\nwhile True:\n    keep.append(bytearray(1 << 20))`,
    syntax: `def f(:\n    pass`,
  },
  c: {
    good: `#include <stdio.h>\nint main(void) { int n; scanf("%d", &n); printf("%d\\n", n * 2); return 0; }`,
    wrong: `#include <stdio.h>\nint main(void) { int n; scanf("%d", &n); printf("%d\\n", n * 3); return 0; }`,
    loop: `int main(void) { volatile int x = 0; while (1) { x++; } }`,
    // Storing the pointer stops the compiler from removing the allocation as unused.
    hog: `#include <stdlib.h>\n#include <string.h>\nchar *volatile last;\nint main(void) { for (;;) { char *p = malloc(1 << 20); memset(p, 1, 1 << 20); last = p; } }`,
    syntax: `int main(void) { return x }`,
  },
  cpp: {
    good: `#include <bits/stdc++.h>\nusing namespace std;\nint main() { int n; cin >> n; vector<int> v{n}; cout << v[0] * 2 << endl; }`,
    wrong: `#include <iostream>\nint main() { int n; std::cin >> n; std::cout << n * 3 << std::endl; }`,
    loop: `int main() { volatile int x = 0; while (true) { x++; } }`,
    hog: `#include <vector>\nint main() { std::vector<char*> k; for (;;) { char* p = new char[1 << 20]; for (int i = 0; i < (1 << 20); i += 4096) p[i] = 1; k.push_back(p); } }`,
    syntax: `int main() { return x }`,
  },
  csharp: {
    good: `using System; class Solution { static void Main() { Console.WriteLine(int.Parse(Console.ReadLine()) * 2); } }`,
    wrong: `using System; class Solution { static void Main() { Console.WriteLine(int.Parse(Console.ReadLine()) * 3); } }`,
    loop: `class Solution { static void Main() { while (true) { } } }`,
    hog: `using System.Collections.Generic; class Solution { static void Main() { var keep = new List<byte[]>(); while (true) { var a = new byte[1 << 20]; a[0] = 1; for (int i = 0; i < a.Length; i += 4096) a[i] = 1; keep.Add(a); } } }`,
    syntax: `class Solution { static void Main() { int x = ; } }`,
  },
  java: {
    good: `import java.util.*; public class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt() * 2); } }`,
    wrong: `import java.util.*; public class Main { public static void main(String[] a) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt() * 3); } }`,
    loop: `public class Main { public static void main(String[] a) { long i = 0; while (true) { i++; } } }`,
    hog: `import java.util.*; public class Main { public static void main(String[] a) { List<byte[]> k = new ArrayList<>(); while (true) { byte[] b = new byte[1 << 20]; for (int i = 0; i < b.length; i += 4096) b[i] = 1; k.add(b); } } }`,
    syntax: `public class Main { public static void main(String[] a) { int x = ; } }`,
  },
};

interface Extra {
  name: string;
  code: string;
  expected: string;
  detail?: RegExp;
  // More than one run checks that a program's state does not leak into the next test.
  runs?: number;
}

const COUNTER_JAVA = `import java.util.*; public class Main { static int runs = 0; public static void main(String[] a) { runs++; System.out.println(new Scanner(System.in).nextInt() * 2 * runs); } }`;

const EXTRAS: Record<string, Extra[]> = {
  javascript: [
    {
      name: 'stream',
      code: `let s = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', (d) => { s += d; }); process.stdin.on('end', () => { console.log(Number(s) * 2); });`,
      expected: 'accepted',
    },
    {
      name: 'readln',
      code: `const rl = require('readline').createInterface({ input: process.stdin }); rl.on('line', (l) => console.log(Number(l) * 2));`,
      expected: 'accepted',
    },
    {
      name: 'timer',
      code: `const n = Number(require('fs').readFileSync(0, 'utf8')); setTimeout(() => console.log(n * 2), 20);`,
      expected: 'accepted',
    },
    {
      name: 'exit',
      code: `console.log(42); process.exit(0); console.log('unreachable');`,
      expected: 'accepted',
    },
    {
      name: 'throw',
      code: `throw new Error('boom');`,
      expected: 'runtime-error',
      detail: /boom/,
    },
    {
      name: 'reject',
      code: `Promise.reject(new Error('boom'));`,
      expected: 'runtime-error',
      detail: /boom/,
    },
    {
      name: 'flood',
      code: `while (true) console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');`,
      expected: 'runtime-error',
      detail: /Output limit/,
    },
  ],
  python: [
    {
      name: 'exit',
      code: `import sys\nprint(42)\nsys.exit(0)\nprint('unreachable')`,
      expected: 'accepted',
    },
    { name: 'throw', code: `raise ValueError('boom')`, expected: 'runtime-error', detail: /boom/ },
    {
      name: 'recurse',
      code: `def f(): return f()\nf()`,
      expected: 'runtime-error',
      detail: /Recursion/,
    },
    {
      name: 'state',
      code: `import builtins\nbuiltins.runs = getattr(builtins, 'runs', 0) + 1\nprint(int(input()) * 2)`,
      expected: 'accepted',
      runs: 2,
    },
  ],
  cpp: [
    {
      name: 'throw',
      code: `#include <vector>\nint main() { std::vector<int> v(1); return v.at(5); }`,
      expected: 'runtime-error',
    },
    {
      name: 'recurse',
      code: `int f(int n) { volatile int x = n; return f(x + 1) + x; }\nint main() { return f(0); }`,
      expected: 'runtime-error',
    },
    {
      name: 'state',
      code: `#include <iostream>\nstatic int runs = 0;\nint main() { runs++; int n; std::cin >> n; std::cout << n * 2 * runs << std::endl; }`,
      expected: 'accepted',
      runs: 2,
    },
  ],
  csharp: [
    {
      name: 'throw',
      code: `class Solution { static void Main() { throw new System.Exception("boom"); } }`,
      expected: 'runtime-error',
      detail: /boom/,
    },
    {
      name: 'zero',
      code: `class Solution { static int Z = 0; static void Main() { System.Console.WriteLine(1 / Z); } }`,
      expected: 'runtime-error',
      detail: /DivideByZero/,
    },
    {
      name: 'state',
      code: `using System; class Solution { static int runs = 0; static void Main() { runs++; Console.WriteLine(int.Parse(Console.ReadLine()) * 2 * runs); } }`,
      expected: 'accepted',
      runs: 2,
    },
    {
      name: 'async',
      code: `using System; using System.Threading.Tasks; class Solution { static Task Main() { Console.WriteLine(42); return Task.CompletedTask; } }`,
      expected: 'accepted',
    },
    {
      name: 'recurse',
      code: `class Solution { static int F(int n) { return F(n + 1) + 1; } static void Main() { F(0); } }`,
      expected: 'runtime-error',
    },
    {
      name: 'after',
      code: `class Solution { static void Main() { System.Console.WriteLine(42); } }`,
      expected: 'accepted',
    },
  ],
  java: [
    { name: 'state', code: COUNTER_JAVA, expected: 'accepted', runs: 2 },
    {
      name: 'objhog',
      // Small objects never reach the allocator failure, so the time limit stops this one.
      code: `import java.util.*; public class Main { public static void main(String[] a) { List<Object> k = new ArrayList<>(); while (true) { k.add(new int[4]); } } }`,
      expected: 'time-limit',
    },
    {
      name: 'zero',
      code: `public class Main { static int z = 0; public static void main(String[] a) { System.out.println(1 / z); } }`,
      expected: 'runtime-error',
      detail: /ArithmeticException/,
    },
    {
      name: 'catch',
      code: `public class Main { public static void main(String[] a) { try { int[] x = new int[1]; x[5] = 1; } catch (ArrayIndexOutOfBoundsException e) { System.out.println(42); } } }`,
      expected: 'accepted',
    },
    {
      name: 'nobrace',
      code: `public class Main { public static void main(String[] a) { long i = 0; for (;;) i++; } }`,
      expected: 'time-limit',
    },
    {
      name: 'swallow',
      code: `public class Main { public static void main(String[] a) { for (;;) { try { while (true) { } } catch (Throwable t) { } } } }`,
      expected: 'time-limit',
    },
    {
      name: 'sleep',
      code: `public class Main { public static void main(String[] a) throws Exception { Thread.sleep(600000); } }`,
      expected: 'time-limit',
    },
    {
      name: 'after',
      code: `public class Main { public static void main(String[] a) { System.out.println(42); } }`,
      expected: 'accepted',
    },
    {
      name: 'solution',
      code: `class Helper { static int twice(int n) { return n * 2; } }\npublic class Solution { public static void main(String[] a) { System.out.println(Helper.twice(new java.util.Scanner(System.in).nextInt())); } }`,
      expected: 'accepted',
    },
    {
      name: 'exit',
      code: `public class Main { public static void main(String[] a) { System.out.println(42); System.exit(0); } }`,
      expected: 'accepted',
    },
    {
      name: 'after',
      code: `public class Main { public static void main(String[] a) { System.out.println(42); } }`,
      expected: 'accepted',
    },
  ],
};

const LOOP_LIMIT_MS = 2000;
// Long enough that a memory hog reaches the memory limit before the time limit.
const HOG_LIMIT_MS = 60000;
const MEMORY_LIMIT_MB = 256;

function problem(language: string, code: string, timeLimitMs: number) {
  return {
    style: 'stdin',
    checker: { type: 'exact' },
    timeLimitMs,
    memoryLimitMb: MEMORY_LIMIT_MB,
    languages: { [language]: { starter: code } },
  };
}

const requested = process.argv.slice(2);
const languages = requested.length > 0 ? requested : Object.keys(PROGRAMS);

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });

// A frozen page must not hang the run forever.
const OVERALL_MS = 15 * 60 * 1000;
const deadline = setTimeout(() => {
  console.error('Gave up: the whole run took too long, so a page probably froze.');
  process.exit(2);
}, OVERALL_MS);

let failures = 0;

// Vite reloads the page the first time it prepares dependencies, so get that out of the way.
const warmup = await browser.newPage();
await warmup.goto('http://localhost:5198/');
await warmup
  .evaluate(async () => {
    const url = '/src/runner/judge.ts';
    await import(/* @vite-ignore */ url);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  })
  .catch(() => {});
await warmup.close();

for (const language of languages) {
  const page = await browser.newPage();
  page.on('crash', () => console.log('  (the browser tab crashed)'));
  if (process.env.RUNNER_DEBUG) {
    page.on('console', (message) => console.log(`  [browser] ${message.text().slice(0, 300)}`));
    page.on('pageerror', (error) => console.log(`  [page error] ${error.message.slice(0, 300)}`));
    page.on('requestfailed', (request) => console.log(`  [request failed] ${request.url()}`));
  }
  await page.goto('http://localhost:5198/');
  const programs = PROGRAMS[language];
  if (!programs) throw new Error(`Unknown language: ${language}`);

  const check = async (
    name: string,
    code: string,
    expected: string,
    detail?: RegExp,
    timeLimitMs = name === 'hog' ? HOG_LIMIT_MS : LOOP_LIMIT_MS,
    runs = 1,
  ) => {
    // RUNNER_ONLY=hog,zero runs just those checks.
    const only = process.env.RUNNER_ONLY?.split(',');
    if (only && !only.includes(name)) return 'skipped';
    const started = Date.now();
    const outcome = await Promise.race([
      page.evaluate(
        async ({ language, problem, code, runs }) => {
          // Vite serves source files by URL, so TypeScript cannot resolve this path.
          const url = '/src/runner/judge.ts';
          const { judge } = await import(/* @vite-ignore */ url);
          const tests = Array.from({ length: runs }, () => ({ input: '21\n', output: '42\n' }));
          const result = await judge(problem as never, language as never, code, tests);
          if (!result.compiled) return { verdict: 'compile-error', detail: result.compileOutput };
          const test =
            result.tests.find((t: { verdict: string }) => t.verdict !== 'accepted') ??
            result.tests.at(-1);
          return {
            verdict: test.verdict,
            detail: `${test.stderr} stdout=${test.stdout.slice(0, 80)} mem=${test.memoryKb} time=${test.timeMs}`,
          };
        },
        {
          language,
          problem: problem(language, code, timeLimitMs),
          code,
          runs,
        },
      ),
      new Promise<{ verdict: string; detail: string }>((resolve) =>
        setTimeout(() => resolve({ verdict: 'PAGE FROZE', detail: '' }), 200_000),
      ),
    ]).catch((error: Error) => ({ verdict: 'PAGE CRASHED', detail: error.message }));

    const passed = outcome.verdict === expected && (!detail || detail.test(outcome.detail));
    if (!passed) failures++;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const summary = outcome.detail.replace(/\s+/g, ' ').trim().slice(0, 150);
    console.log(
      `  ${passed ? 'PASS' : 'FAIL'}  ${name.padEnd(7)} ${outcome.verdict.padEnd(14)} ${seconds.padStart(6)}s  ${summary}`,
    );
    return outcome.verdict;
  };

  console.log(`\n${language}`);
  await check('good', programs.good, 'accepted');
  await check('wrong', programs.wrong, 'wrong-answer');
  await check('loop', programs.loop, 'time-limit');
  const hog = await check('hog', programs.hog, 'memory-limit');
  await check('syntax', programs.syntax, 'compile-error', /\S/);
  // JavaScript has no way to measure a worker's object memory. With the real 5 second limit,
  // the worker is terminated while the page is still healthy, and the later flood check
  // proves that it stays healthy.
  if (programs.objectHog) {
    await check('obj-hog', programs.objectHog, 'time-limit', undefined, 5000);
    await check('after', programs.good, 'accepted');
  }
  for (const extra of EXTRAS[language] ?? []) {
    await check(
      extra.name,
      extra.code,
      extra.expected,
      extra.detail,
      LOOP_LIMIT_MS,
      extra.runs ?? 1,
    );
  }
  if (hog.startsWith('PAGE')) await page.close().catch(() => {});
  else await page.close();
}

clearTimeout(deadline);
await browser.close();
await server.close();

console.log(failures === 0 ? '\nAll runner checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
