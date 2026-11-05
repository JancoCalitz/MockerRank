# Progress

The project moved to browser-only on 2026-11-05; see the revision at the top of
[HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md).

Phases are not being done in plan order. Phase 3 came before Phase 2, because the runners were the
biggest risk.

## Phase 0: Scaffold and tooling (done)

- Vite, React, TypeScript, and Tailwind static app with a browser check page.
- `npm start` for local use, and a GitHub Actions workflow for GitHub Pages.
- `npm install` creates a git-ignored `.env` from `.env.example` for AI keys.
- The owner will set up GitHub Pages later. Until then, the workflow's deploy step is expected to
  fail on each push.

## Phase 1: Content model and question bank format (done)

- Schemas for MCQs, coding problems, and exams in `src/content/schema.ts`. Format guide in
  [content/README.md](content/README.md).
- `npm run content:validate` rejects schema errors, unknown fields, duplicate ids, bad exam
  references, and reference solutions that fail their tests.
- Sample bank: 18 MCQs, 1 short and 1 long coding problem, and 1 exam, all original.

Custom checker scripts run with `new Function`. That is fine for this project's own content, but
question packs imported in Phase 9 must not be treated as trusted.

## Phase 3: Code execution (done, except in a production build)

`src/runner/judge.ts` provides `runProgram`, `runCode`, `submit`, and `judge`. Programs run one at a
time per browser. Time limits scale by language, because WebAssembly is slower than native code.

- `npm run test:runners` runs each language in Edge: correct code passes, wrong code fails, an endless
  loop hits the time limit, a memory hog hits the memory limit, and a syntax error is readable. It
  also checks input styles, crashes, recursion, output floods, and state leaking between tests.
- `npm run content:validate:browser` compiles every starter and runs every reference solution through
  the real runners.

| Language   | Runtime                  | First run      | Memory limit                |
| ---------- | ------------------------ | -------------- | --------------------------- |
| C, C++     | Clang in WebAssembly     | About 100 MB   | Exact                       |
| C#         | Our .NET and Roslyn      | About 34 MB    | Exact                       |
| Java 17    | CheerpJ, from its CDN    | Needs internet | Approximate, see below      |
| Python 3   | Pyodide                  | About 13 MB    | Checked after the run, 4 GB |
| JavaScript | The browser, in a worker | Nothing        | See below                   |
| TypeScript | The browser, in a worker | About 9 MB     | See below                   |

Not yet verified:

- **The runners have only run on the Vite dev server, not in a production build.** Phase 4's
  end-to-end test must cover this, for local `npm start` and for GitHub Pages.
- Only Edge has been tested. Chrome should behave the same, as it uses the same engine.

Known limits:

- **C++:** code using `throw` or `try` does not compile, because the WebAssembly library has no
  exception support. Errors like `vector::at` out of range stop the program as a runtime error.
- **Java:** CheerpJ runs Java on the page's main thread. `java-instrument.ts` adds a guard to every
  loop, which enforces the time limit and keeps the page responsive. Something that loops inside the
  Java library, such as an infinite stream, has no guard and could freeze the tab.
- **Java memory:** the JVM reports fixed values and no browser figure proved reliable, so the limit is not enforced directly. A program is stopped by the allocator failing near 8 GB, by the time limit, or by its own `OutOfMemoryError`. A program using more than its limit but less than that is not caught.
- **Java errors:** exceptions from CheerpJ can have no message, unlike real Java, so a divide by zero
  shows `ArithmeticException` without `/ by zero`.
- **JavaScript and TypeScript:** a browser cannot measure a worker's object memory. Large typed arrays
  are reported as a memory limit. A runaway program using ordinary objects hits the time limit
  instead. Its limit is 5 seconds, because reaching about 5 GB would freeze the tab for good.
- **TypeScript:** reports syntax errors but not type errors, because it only transpiles.
- **Python:** a memory hog is detected at about 4 GB, or if it finishes over the limit.
- **Speed:** a heavy Java loop runs about 20x slower than a native JVM, so its time limit is 5x longer.

`runners/csharp/publish` is a committed build. Rebuilding needs the .NET SDK; see
[runners/csharp/README.md](runners/csharp/README.md).

## Next

1. Rework Phase 2 as attempt state and a timer kept in the browser, so an attempt survives refreshing
   and closing the tab, and expiry auto-submits. Accounts and the database no longer apply.
2. Phase 4: the candidate UI, with an end-to-end test on a production build.
