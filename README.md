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

## Layout

| Path             | Contents                                    |
| ---------------- | ------------------------------------------- |
| `src`            | React, TypeScript, and Tailwind app         |
| `content`        | Question bank and exam definitions          |
| `runners/csharp` | Source for the C# compiler bundle (.NET 10) |
| `scripts`        | Project helper scripts                      |
