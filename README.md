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

## Practice modes

- **Full exam:** a timed 20-question exam, either a fixed mock or a random one that avoids questions
  you have seen. Scores count towards your progress. Choose strict mode to turn the assistant off.
- **Topic drill:** untimed multiple choice by topic, with the answer after each question. It also
  offers the questions you got wrong, until you get them right.
- **Coding gym:** one problem at a time, with no timer, plus hints and the editorial. It recommends
  problems from what you missed and your weakest topics, and has fix-the-code problems, where you find
  the bug in a program.

## Themes and shortcuts

The **Theme** button switches between Classic and eight era themes, from a 1950s diner to 2020s
aurora glass. Moving backgrounds pause during a test or coding problem, and the menu can turn them
off altogether, or turn on short sounds when code runs and passes.

During a test, **1–4** or **A–D** choose an answer, **←** and **→** move between questions, **F**
flags a question, and **?** lists the shortcuts. In the editor, **Ctrl+Enter** runs your code and
**Ctrl+Shift+Enter** submits it. The dividers between the problem, editor, and results can be
dragged, or moved with the arrow keys.

## Working offline

After your first visit, the app opens with no internet connection. Each language is saved once you have
used it, so it works offline from then on. Java is the exception, as it always loads from CheerpJ's
servers. The AI assistant also needs a connection.

## AI assistant key

The assistant uses your own API key, from Anthropic, OpenAI, or another compatible provider.

- **Running locally:** `npm install` creates a blank `.env` file. Paste your key there. Git ignores
  this file, so your key will not be committed.
- **On GitHub Pages:** paste your key into the app. It stays in the browser until you close it, and
  is only sent to your provider. Do not add it to the repository or to a Pages build, because anything
  in a published site can be read by anyone.

Each message uses your provider account. With Claude, a reply uses `claude-opus-5-5` unless you choose
another model, and a separate check on each reply uses the cheaper `claude-haiku-5-5`. With other
providers, your chosen model handles both. A provider must allow requests from a web page, which some
do not.

Choose **Strict mode** when starting a test to turn the assistant off.

## Share it

Everyone's answers and progress stay in their own browser, so people cannot see each other's work.

**On your local network:** run `npm run start:lan`, and others can open `http://<your-computer's-IP>:8080`.
The app runs on each person's own computer, in their browser. It only needs yours to serve the files.
They may need to allow it through your firewall. The `.env` key is only offered to pages opened on your
own computer, so everyone else pastes their own key into the app.

**On GitHub Pages:** in the repository's settings, set Pages to deploy from GitHub Actions, then add a
repository variable called `DEPLOY_PAGES`, set to `true`. Each push to `main` then deploys the site. The
published site is public on most GitHub plans, including every question and solution.

**Beyond your local network:** use GitHub Pages or another static host, which serves the app over HTTPS.
Do not expose `start:lan` to the internet: it is a simple local server, without HTTPS. If you host the
files yourself, your web server needs to support HTTPS and HTTP range requests, which Java needs. Never
put a key in the built files, because anyone can read them.

## Your data

Attempts are stored in your browser, and clearing its data deletes them. Under **Packs and backups**,
you can back up your progress to a file and restore it, and export or import question packs.
[content/README.md](content/README.md) describes the format of a pack.

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
