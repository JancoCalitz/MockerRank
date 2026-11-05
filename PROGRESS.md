# Progress

The project moved to browser-only on 2026-11-05; see the revision at the top of
[HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md).

Phases are not being done in plan order: Phase 3 came before Phase 2, because the runners were the
biggest risk.

## Done

### Phase 0: Scaffold and tooling

- Vite, React, TypeScript, and Tailwind static app.
- `npm start` for local use, and a GitHub Actions workflow for GitHub Pages.
- `npm install` creates a git-ignored `.env` from `.env.example` for AI keys.
- The owner will set up GitHub Pages later. Until then, the workflow's deploy step is expected to
  fail on each push.

### Phase 1: Content model and question bank format

- Schemas for MCQs, coding problems, and exams in `src/content/schema.ts`. Format guide in
  [content/README.md](content/README.md).
- `npm run content:validate` rejects schema errors, unknown fields, duplicate ids, bad exam
  references, and reference solutions that fail their tests.
- Sample bank: 18 MCQs, 1 short and 1 long coding problem, and 1 exam, all original.

Custom checker scripts run with `new Function`. That is fine for this project's own content, but
question packs imported in Phase 9 must not be treated as trusted.

### Phase 2: Attempts and timer, reworked for the browser

- `src/attempt` holds the attempt lifecycle, saved to local storage on every change.
- The deadline is stored when the attempt starts, so refreshing or closing the tab cannot reset it,
  and an attempt that ran out while closed is finished on return. Expiry submits automatically.
- There are no accounts. One attempt is kept per browser, and the computer's clock can be changed to
  cheat, which is acceptable for practice.

### Phase 3: Code execution

`src/runner/judge.ts` provides `runProgram`, `runCode`, `submit`, and `judge`. Programs run one at a
time per browser. Time limits scale by language, because WebAssembly is slower than native code.

| Language   | Runtime                  | First run      | Memory limit                |
| ---------- | ------------------------ | -------------- | --------------------------- |
| C, C++     | Clang in WebAssembly     | About 100 MB   | Exact                       |
| C#         | Our .NET and Roslyn      | About 34 MB    | Exact                       |
| Java 17    | CheerpJ, from its CDN    | Needs internet | Near 8 GB only, see below   |
| Python 3   | Pyodide                  | About 13 MB    | Checked after the run, 4 GB |
| JavaScript | The browser, in a worker | Nothing        | See below                   |
| TypeScript | The browser, in a worker | About 9 MB     | See below                   |

Known limits:

- **C++:** code using `throw` or `try` does not compile, because the WebAssembly library has no
  exception support. Errors like `vector::at` out of range stop the program as a runtime error.
- **Java:** CheerpJ runs Java on the page's main thread. `java-instrument.ts` adds a guard to every
  loop, which enforces the time limit and keeps the page responsive. Something that loops inside the
  Java library, such as an infinite stream, has no guard and could freeze the tab.
- **Java memory:** the JVM reports fixed values and no browser figure proved reliable, so the limit
  is not enforced directly. A program is stopped by the allocator failing near 8 GB, by the time
  limit, or by its own `OutOfMemoryError`. A program using more than its limit but less than that is
  not caught.
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

### Phase 4: Candidate UI

- Landing page, top bar with timer and numbered question tiles, multiple choice view, and coding view
  with Monaco, per-language code, Run Code, Submit Code, custom input, and per-test results.
- Flagging, final submit confirmation, keyboard shortcuts (Ctrl+Enter, Ctrl+Shift+Enter), and editor
  font size, tab size, and theme.
- A button shows or hides hidden tests. Showing them marks the attempt as assisted for good.

### Phase 5: Scoring and results

- `src/attempt/score.ts` scores each question. A multiple choice question is worth 1 point, and a
  coding problem is weighted by the tests it passes, with each sample test worth 1. Sections default
  to 40% multiple choice, 20% short, and 40% long. An exam can change these under `scoring`, including
  `multiSelect: partial` instead of the default all-or-nothing.
- **An attempt is scored on its final code.** Finishing judges any code that was never submitted or
  changed since its last submit, including when time runs out. So a good submission followed by a
  broken edit scores the broken edit, the same as if that edit had been submitted.
- The results page shows the total against the 80% target, sections, topics, and a review of each
  question, with answers, explanations, per-test results, the code, the editorial, and time spent.
- The progress page shows the average of the last 3 unassisted attempts, the score trend, the weakest
  topics, and every attempt. Assisted attempts appear on the chart and in the list, but do not count
  towards the target or the weakest topics.
- `src/attempt/history.ts` keeps attempts in this browser. If storage fills up, the oldest attempts
  lose their review detail but keep their scores. Clearing browser data deletes all of it.

The plan's admin leaderboard does not apply, because no data is shared between people.

## How it is tested

| Command                            | Covers                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm test`                         | Attempt logic, storage, checkers, loop guard, validator, and UI |
| `npm run content:validate`         | The question bank, running solutions locally where possible     |
| `npm run test:runners`             | Every language's limits and behaviour, in Edge                  |
| `npm run content:validate:browser` | Every starter and reference solution, in Edge                   |
| `npm run test:e2e`                 | A whole attempt on the production build, under a subfolder      |

Only Edge has been tested. Chrome should behave the same, as it uses the same engine. The app has not
yet run on GitHub Pages itself, or on a slow connection, where the first use of a language will take
much longer. There is no download progress bar yet, only a message while it runs.

## Next

1. Phase 6: AI assistant, using each person's own key.
2. Phase 7: tracking of tab switches and similar events.
3. Phase 8: the full question bank. Ruby, PHP, and Lua can be added then if they test well.
4. Phase 9: practice modes, question pack import and export.
