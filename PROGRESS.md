# Progress

The project moved to browser-only on 2026-11-05; see the revision at the top of
[HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md).

## Phase 0: Scaffold and tooling (done)

- Vite, React, TypeScript, and Tailwind static app with a browser check page.
- `npm start` for local use, and a GitHub Actions workflow for GitHub Pages.
- `npm install` creates a git-ignored `.env` from `.env.example` for AI keys.
- The owner will set up GitHub Pages later. Until then, the workflow's deploy step is expected to
  fail on each push.

## Phase 1: Content model and question bank format (done)

- Schemas for MCQs, coding problems, and exams in `src/content/schema.ts`. Format guide in
  [content/README.md](content/README.md).
- Stdin and function-completion problems, weighted hidden tests, and exact, token, float-tolerance,
  and custom checkers.
- `npm run content:validate` rejects schema errors, unknown fields, duplicate ids, bad exam
  references, and reference solutions that fail their tests.
- Sample bank: 18 MCQs, 1 short and 1 long coding problem, and 1 exam, all original.

Limits to pick up in Phase 3:

- Validation runs JavaScript, TypeScript, and Python solutions locally. C#, Java, C++, and the others
  are listed as not verified until they can run through the browser runners.
- The sample long problem allows only JavaScript, TypeScript, and Python, because its harnesses can
  be verified. It still needs C#, Java, and C++ harnesses and solutions.
- The sample short problem has C#, Java, and C++ starter code that has never been compiled. The C++
  starter uses `bits/stdc++.h`, which the C++ runner must supply.
- Custom checker scripts run with `new Function`. That is fine for this project's own content, but
  question packs imported in Phase 9 must not be treated as trusted.

## Language runner findings

Results from throwaway tests. Only the C# runner source is in the repo so far.

| Language | Approach                              | Status                                                                                                                                                             |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C#       | Own .NET 10 and Roslyn bundle, 34 MB  | Works in Edge. Compile 0.3-1.8 s. Full library: `Console.ReadLine`, `PriorityQueue`, LINQ, `BigInteger`, regex, stack traces. Building it needs the .NET SDK once. |
| Java     | CheerpJ 5.0 (real JVM) with its javac | Works in Edge: Java 17, `Scanner`, records, exceptions, readable errors. Compile 4-8 s. About 20x slower than TeaVM on a heavy loop.                               |
| C++      | `@yowasp/clang`, about 100 MB         | Works in Node, not yet tried in a browser. Compile 3-7 s. Memory cap works. Needs `-fno-exceptions`, so `throw` will not compile. Needs our own `bits/stdc++.h`.   |
| C#       | `@wasmsharp/core`                     | Rejected. Library is trimmed: no `Console.ReadLine`, `Console.Write`, `Queue.Peek`, `Enumerable.Sum()`.                                                            |
| Java     | `teavm-javac`                         | Rejected. No `Scanner` or `System.setIn`, no `Integer::sum`, `String.format` crashes, array bounds errors cannot be caught.                                        |

Not yet tested: JavaScript, TypeScript, C, Python, Ruby, PHP, Lua, and stopping a runaway program in
each runtime (the time limit).

Known constraints:

- CheerpJ's free licence requires attribution and loading from its CDN, so Java needs internet access
  at least on first load. It also needs a web server that supports HTTP range requests.
- C# runs on .NET's interpreter. The bundle is built with `dotnet publish` in `runners/csharp`; how
  the output is stored and served is a Phase 3 decision.

## Next

Phase 2 was written for accounts and a server-side database, which no longer apply. Rework it as
attempt state and a timer kept in the browser, so an attempt survives refreshing and closing the
tab, and expiry auto-submits.
