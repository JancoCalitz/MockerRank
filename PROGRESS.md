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
- **TypeScript:** type errors now stop a program, using the real compiler in non-strict mode. Candidates
  have Node's input APIs, but other Node modules are not declared, and do not exist at run time either.
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

### Phase 6: AI assistant

- A chat tab on coding questions, using each person's own key, with Claude through the official SDK,
  or OpenAI and compatible providers through the OpenAI chat format. Strict mode turns it off.
- The prompt holds the problem statement, the candidate's code, and the rules. Hidden tests, the
  editorial, and reference solutions are never sent.
- Each reply is limited to 1,500 characters and 6 lines of code, then checked by a second model call.
  Anything that fails, or a check that fails or gives an unclear answer, is replaced with a hint. The
  candidate never sees the blocked reply, and it is not stored.
- There is a cap of 10 messages per question by default. A failed request does not use one up.
- Every message is saved with the attempt, and appears in the results review.
- Locally, the key comes from `.env` through a local-only endpoint (`scripts/local-ai-config.ts`) that
  only answers same-origin requests to a localhost address. On GitHub Pages it is pasted into the app
  and kept in session storage. No key is ever built into the site.
- Claude requests set `fallbacks: "default"` and low effort, on the models that accept them.

Known limits:

- **Not yet tried against a real provider.** The tests mock the providers. They confirm what is sent
  and how replies are handled, but not a real API's answer, or how well the prompt resists a determined
  user. Try it with a real key before relying on it.
- The plan asks for the cap to hold if the client is tampered with. That cannot be met without a
  server: someone who edits local storage can reset it. The plan's revision accepts this for practice.
- A key in a browser can be read by that person and by browser extensions, which is why each person
  uses their own.
- OpenAI and others use the chosen model for the check too, so each message costs two full calls.

### Phase 7: Test conditions tracking

- `src/attempt/integrity.ts` records leaving the tab or window, time away, leaving full screen, copy
  and paste in the editor, right-clicks, and resizes, with timestamps and the question open at the
  time. It records that these happened, never what was copied or pasted.
- One tab switch fires both a focus and a visibility event, so reports count each time the candidate
  left, not each event. A window resize counts once per drag.
- Full screen can be required when starting a test, which shows a banner with a button to return. A
  warning appears after 2 violations by default, counting leaving the test and leaving full screen.
  Copying, pasting, and resizing are reported but do not count, as they are normal while coding.
- A real tab switch was tested against the production build by driving Edge directly, because
  automation tools keep pages focused: it logged one departure and the correct time away. The
  end-to-end test uses simulated events for this reason.
- Results show a summary and a timeline. Nothing is blocked, and the score is not affected. This is
  practice conditioning, and anyone can change their own browser's data.

Limits:

- A browser cannot see other devices, or a second monitor if the window keeps focus.
- Copy and paste are only tracked in the editor, as the plan asks.
- Clicking a browser's own controls, such as the address bar, also counts as leaving.

### Phase 8: Question bank (first batch of three or so)

| Type            | Now | Target |
| --------------- | --- | ------ |
| Multiple choice | 90  | 200+   |
| Short coding    | 5   | 40+    |
| Long coding     | 5   | 25+    |

- 5 fixed mock exams, with no question in more than one and every topic in each.
- Every coding problem has a starter and a reference solution in C#, Java, C++, C, JavaScript,
  TypeScript, and Python. A problem's large test gets its expected output from the Python solution,
  and the other six languages have to agree with it.
- Random exams avoid questions already seen, and cover every topic. A unit test generates 5 in a row
  with no repeats across 8 seeds, which is the plan's acceptance test.

Limits:

- **Human review is still needed.** Validation proves that code solutions agree and pass their tests,
  but not that the multiple choice answers, or the wording of any question, are right. They were
  written carefully, but only a person checking them meets the plan's "human-reviewed".
- Large tests live in `content/tests`, and download only on submit. Naive quadratic solutions were
  confirmed to hit the time limit in JavaScript for `peak-window`, `budget-pairs`, and `quiet-stretch`.
  Others have not been checked this way.
- The sample exam became Mock Exam 1, so an attempt in progress on it from before this change is
  discarded. Finished attempts keep their scores, but cannot be reopened from the old exam id.

### Phase 9: Polish and group readiness

- Practice modes: full exam, topic drill (`src/practice/drill.ts`), and coding gym.
- `src/content/packs.ts` imports and exports question packs, checking them first. Packs cannot use custom
  checkers, which run as code in the page.
- `src/attempt/backup.ts` backs up and restores progress. This replaces the plan's SQLite backup script.
- An error screen catches failures, and a language that fails to download shows an error and can be
  retried. This replaces the plan's Judge0 outage handling.
- `npm run start:lan` serves the app on the local network, and deployment notes are in the README. All
  7 languages were run through this computer's network address over plain HTTP, and the `.env` endpoint
  correctly refused it. No second computer was used, so a firewall could still block real visitors.
- The plan's three-person test runs in `npm run test:e2e`, with three separate browser profiles at once.

Limits:

- Each person's data is in their own browser. A person using two browsers has two separate histories,
  unless they move a backup between them.
- Drills and the gym do not count as seen questions for random exams.
- Imported pack solutions are not run on import.

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

1. Phase 8: the remaining question batches, after the owner has spot-checked this one. Ruby, PHP, and
   Lua can be added if they test well.
2. Phase 9: practice modes, question pack import and export.
