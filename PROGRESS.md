# Progress

The project moved to browser-only on 2026-11-05; see the revision at the top of
[HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md).

## Phase 0: Scaffold and tooling (reworked for browser-only)

- Vite, React, TypeScript, and Tailwind static app with a browser check page.
- `npm start` for local use, and a GitHub Actions workflow for GitHub Pages.
- `npm install` creates a git-ignored `.env` from `.env.example` for AI keys.
- The Pages workflow has not run yet, because nothing has been pushed.

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

1. Push to GitHub and enable Pages. A private repo needs a paid GitHub plan for Pages.
2. Phase 1: content model and question bank format.
