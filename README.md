# MockerRank

A browser-only practice environment for timed software engineering assessments: a 20-question exam
(18 multiple choice, 1 short coding, 1 long coding) with an in-browser editor, tests you can hide or
reveal, an AI assistant using your own key, and a scored report.

All code runs inside your browser using WebAssembly. There is no server, database, or Docker.

See [HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md) for the plan and
[PROGRESS.md](PROGRESS.md) for current status.

## Use it

**Online:** open the GitHub Pages link for this repository. Nothing needs installing.

**Locally:** with [Node.js](https://nodejs.org/) 24 or later installed, run:

```sh
npm install
npm start
```

Then open <http://localhost:8080>.

## AI assistant key

The assistant uses your own API key, from Anthropic, OpenAI, or another compatible provider.

- **Running locally:** `npm install` creates a blank `.env` file. Paste your key there. Git ignores
  this file, so your key will not be committed.
- **On GitHub Pages:** paste your key into the app. Do not add it to the repository or to a Pages
  build, because anything in a published site can be read by anyone.

## Develop

| Command                | Purpose                         |
| ---------------------- | ------------------------------- |
| `npm run dev`          | Start the dev server            |
| `npm test`             | Run unit tests                  |
| `npm run lint`         | Lint with ESLint                |
| `npm run typecheck`    | Type-check                      |
| `npm run format`       | Format with Prettier            |
| `npm run format:check` | Check formatting                |
| `npm run build`        | Build the static site to `dist` |

These also need Microsoft Edge installed, and take a few minutes:

| Command                            | Purpose                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `npm run test:runners`             | Test every language's runner in a real browser         |
| `npm run content:validate:browser` | Check all starter code and solutions in a real browser |
| `npm run test:e2e`                 | Take a whole attempt through the production build      |

## Languages

C#, Java 17, C++20, C, JavaScript, TypeScript, and Python 3 run in the browser. Each one downloads
the first time you use it, and the browser then keeps a copy. Java needs internet access, and uses
[CheerpJ](https://cheerpj.com) under its free licence. [PROGRESS.md](PROGRESS.md) lists the known
limits of each language.

## Layout

| Path             | Contents                                                   |
| ---------------- | ---------------------------------------------------------- |
| `src`            | React, TypeScript, and Tailwind app                        |
| `src/runner`     | Runs and judges code in the browser                        |
| `src/content`    | Question formats and output checkers                       |
| `content`        | Question bank and exam definitions                         |
| `public`         | Static files, including generated language runtimes        |
| `runners/csharp` | C# compiler bundle (.NET 10): source and a committed build |
| `scripts`        | Project helper scripts and browser tests                   |
