# Project: MockerRank — Private HackerRank-Style Assessment Simulator

You are building a private, self-hosted practice environment for a small trusted group preparing for a HackerRank **Software Engineer** assessment. It must feel as close as possible to the real thing: timed session, 20 questions (18 multiple choice, 1 short coding, 1 long coding), in-browser editor, run-against-sample-tests, hidden test cases, a capped AI assistant, and a scored report.

Work phase by phase. **Finish and verify each phase (acceptance criteria) before starting the next.** Commit after each phase. Keep a `PROGRESS.md` updated with what is done and what is next.

## Revision, 2026-11-05: browser-only (overrides anything below that conflicts)

The owner changed direction. It must run on a PC in a browser with no additional setup for the person practising.

- **No Docker, Judge0, or database.** All code runs in the browser using WebAssembly. Replaces the Phase 3 Judge0 design and the Phase 0 `docker compose up` acceptance test. The `run(language, sourceCode, stdin, limits)` interface stays.
- **No accounts or shared data.** Progress is session to session, kept in the browser at most. Phase 2 tables, the admin leaderboard, and the "three people simultaneously" acceptance test no longer apply.
- **Hidden tests are not secret.** They ship to the browser, with a button to hide or reveal them. An attempt where they were revealed is labelled "assisted". Scoring and the timer run in the browser and can be tampered with, which is acceptable for self-improvement.
- **Required languages:** C#, Java, C++, JavaScript, TypeScript. Add as many others as can be well supported, each loaded only when first selected.
- **Two ways to run:** a static site on GitHub Pages, and locally with `npm start`. Acceptance for Phase 0 is that a fresh clone with `npm install` and `npm start` shows the app.
- **AI assistant uses each person's own key,** from Claude, OpenAI, or a compatible provider, called directly from the browser. Locally the key lives in a git-ignored `.env`, created blank by `npm install`, and is served only to the local page. On GitHub Pages it is pasted into the app and kept in the browser. A key must never be built into the site. The Phase 6 limits run in the browser, so they are practice guardrails rather than enforcement.
- **Defaults from HackerRank's published table:** C and C++ 2 s, Java 4 s, Python 3 10 s; 512 MB for most languages; 50 KB maximum code size. WebAssembly runs slower, so limits need a per-language multiplier.

## Ground rules

- Private use only. Do not copy HackerRank's or any company's problem text. All questions in the bank must be **original**, written in the same style and difficulty.
- Everything runs locally via Docker Compose. One command to start: `docker compose up`.
- Untrusted code is executed only inside sandboxes (see Phase 3).
- Prefer simple, boring tech. No microservices.

## Recommended stack

- Frontend: React + TypeScript + Vite, Monaco Editor, Tailwind.
- Backend: Node + TypeScript (Fastify or Express) with SQLite (better-sqlite3) via a thin data layer.
- Code execution: self-hosted **Judge0** (Docker Compose) as the default runner. Fallback: per-language Docker runner containers.
- AI helper: Anthropic Claude API, called only from the backend (API key in `.env`, never in the browser).
- Question bank: JSON/YAML files in `/content`, validated by a schema at startup.

---

## Phase 0 — Scaffold and tooling

Deliver:
- Monorepo: `/apps/web`, `/apps/api`, `/content`, `/infra`.
- `docker-compose.yml` running web, api, Judge0 (+ its Postgres/Redis), and SQLite volume.
- `.env.example`, README with setup steps, lint/format/test scripts.
- Health endpoint and a hello-world page that calls it.

Acceptance: fresh clone + `docker compose up` shows the web app and a passing health check.

## Phase 1 — Content model and question bank format

Define and validate schemas (zod or JSON Schema):

- **MCQ**: id, topic, difficulty, stem (markdown, supports code blocks), options (4), correctIndex (support multiple-correct as an option flag), explanation, tags.
- **Coding**: id, title, type (`short` | `long`), statement (markdown), input/output format, constraints, sample tests (visible), hidden tests (with weights), time limit, memory limit, allowed languages, starter code per language, checker type (`exact` | `token` | `float-tolerance` | `custom`), editorial/solution notes.
- **Test set ("exam")**: id, name, 18 MCQ ids, 1 short coding id, 1 long coding id, duration (default 90 minutes, configurable).
- Support both **stdin/stdout** problems and **function-completion** problems (user fills in a function; a harness reads input, calls it, prints output).

Include a CLI `npm run content:validate` that fails on schema errors, duplicate ids, or coding problems whose reference solution fails its own tests.

Acceptance: sample content validates; invalid content is rejected with clear errors.

## Phase 2 — Auth, sessions, and data layer

- Simple accounts: display name + passphrase (group passphrase or per-user). Admin role for the owner.
- Tables: users, exams, attempts, answers, submissions, chat_messages, events (proctor-style events).
- Attempt lifecycle: `not_started → in_progress → submitted | expired`.
- **Server-authoritative timer**: store `startedAt` and `deadline` on the server; the client only displays it. Refreshing the page must not reset or extend time. Auto-submit on expiry.
- Resume an in-progress attempt after refresh or disconnect.

Acceptance: start an attempt, refresh, close the tab and reopen — the timer and saved answers are intact; expiry auto-submits.

## Phase 3 — Code execution service

- Integrate Judge0 behind a backend `runner` module with a clean interface: `run(language, sourceCode, stdin, limits) → {stdout, stderr, status, timeMs, memoryKb}`.
- Languages (initial): Python 3, Java, JavaScript (Node), C++. Make adding a language a config change.
- Enforce per-problem time and memory limits; network disabled; output size cap; wall-time and CPU-time limits; process-count limit.
- Map statuses: Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compilation Error.
- Implement checkers: exact, token-based (whitespace-insensitive), float tolerance, and custom checker (a small program/script per problem).
- Two actions, like HackerRank: **Run Code** (visible sample tests only, shows input/expected/actual) and **Submit** (all tests including hidden; show only pass/fail counts per test, not hidden data).
- Queueing and rate limit per user so the group cannot overwhelm the box.

Acceptance: for each language, a known-good solution passes, a wrong solution fails, an infinite loop hits TLE, a memory hog hits MLE, a syntax error returns a readable compilation error.

## Phase 4 — Candidate UI (the HackerRank feel)

Build the test-taking interface:

- Landing/instructions page (rules, duration, question count, what is tracked), with a Start button.
- Main layout: top bar with countdown timer and question navigator (numbered tiles showing answered / flagged / unanswered); left panel with question; right panel with editor for coding questions.
- **MCQ view**: options, single or multiple select, clear/flag-for-review, autosave on every change.
- **Coding view**: Monaco editor, language dropdown (keeps separate code per language), starter code, Run Code and Submit buttons, custom-input tab, results panel with per-test status, compile/runtime errors, time and memory.
- Navigation between questions without losing state; confirmation dialog on final submit that shows unanswered/flagged count.
- Keyboard shortcuts for run and submit; editor settings (font size, theme, tab size).
- Responsive for laptop screens; no mobile requirement.

Acceptance: a full 20-question attempt can be completed end to end with all answers persisted.

## Phase 5 — Scoring and results

- Scoring: MCQ = 1 point each (support partial rules for multi-select, configurable); coding = weighted by test cases passed; configurable weighting between MCQ, short and long coding (default 40% MCQ, 20% short, 40% long).
- Results page: total score, percentage, per-question breakdown, correct answers with explanations, per-test coding results (reveal hidden test inputs only after submission, optional setting), time spent per question, topic-level performance.
- **Readiness view**: for each user, history of attempts, score trend, weakest topics, and a clear indicator of progress toward the 80% target.
- Admin view: leaderboard for the group and per-attempt drill-down.

Acceptance: scoring is verified with unit tests for edge cases (no answer, multi-select partial, zero tests passed, all passed).

## Phase 6 — AI assistant with limits

Mimic a restricted in-test assistant:

- Chat panel on coding questions. Backend proxies the Claude API; the system prompt includes the problem statement, the candidate's current code, and the rules.
- Configurable policy per exam (defaults): max N messages per question (e.g. 10), hints and conceptual explanations only, **no complete solutions**, no writing large blocks of code, no answers to MCQs.
- Enforcement beyond the prompt: server-side message cap; a post-check on every response (second lightweight model call or heuristics) that blocks replies containing a full solution and substitutes a hint; length cap on responses.
- Log every message to the database and show them in the results review, so the group can learn how they used the assistant.
- A toggle to turn the assistant off for "strict mode" attempts.

Acceptance: asking for the full solution gets a hint instead; the message cap is enforced even if the client is tampered with.

## Phase 7 — Proctor-style tracking (lightweight)

- Record events: tab/window blur and focus, fullscreen exit, copy/paste in the editor, right-click, window resize; store counts and timestamps.
- Optional fullscreen requirement and a warning banner after N violations.
- Show an integrity summary on the results page. This is practice conditioning, not enforcement.

Acceptance: switching tabs during an attempt is logged and visible in the results.

## Phase 8 — Content: original question bank

Build the bank with a generator-assisted but human-reviewed workflow.

- **MCQ (target 200+)**, spread across: arrays and strings, hashing, sorting and searching, stacks and queues, linked lists, trees and graphs, recursion and dynamic programming basics, Big-O reasoning, OOP and design principles, SQL (joins, group by, subqueries), debugging and code-reading ("what does this output"), language trivia for the allowed languages, REST/HTTP basics, Git basics, testing basics.
- **Short coding (target 40+)**: 15–20 minute problems, easy to medium.
- **Long coding (target 25+)**: 40–50 minute problems, medium to hard, multi-step.
- Each item has an explanation (MCQ) or reference solution plus hidden tests, including edge cases, large inputs for complexity checks, and tricky I/O formats.
- Content validation (Phase 1 CLI) must pass: every reference solution passes all of its tests in every allowed language where a reference exists.
- Exam generator: build random 20-question exams (18/1/1) balanced across topics and difficulty, avoiding questions a user has already seen, plus fixed named mock exams.

Acceptance: at least 5 distinct full mock exams can be generated with no overlap.

## Phase 9 — Polish and group readiness

- Practice modes: **Full exam** (timed, strict), **Topic drill** (untimed MCQs by topic), **Coding gym** (single problem, no timer, hints allowed).
- Import/export of question packs; backup script for the SQLite database.
- Error handling and loading states throughout; Judge0 outage degrades gracefully.
- Basic end-to-end tests (Playwright) for the complete attempt flow; unit tests for scoring and checkers.
- Deployment notes for running on one machine on the local network, plus a note on adding HTTPS if exposed beyond LAN.

Acceptance: three people can take exams simultaneously with no state leakage between them.

---

## Definition of done

1. A candidate can log in, take a timed 20-question exam (18 MCQ + 1 short + 1 long coding) in the browser, run and submit code in at least four languages, use a capped AI assistant, and receive a detailed scored report.
2. The server controls the timer and scoring; hidden tests stay hidden until after submission.
3. All content is original and validated.
4. `docker compose up` starts everything from a fresh clone.

## Notes for the owner (not for the agent)

- Before Phase 4, take HackerRank's public sample test once and note: the exact interface, question navigation, how stdin is read, which languages are offered, and the AI assistant's limits. Update the defaults in this plan to match.
- The target of 80%+ comes from repetition: take full mocks, then review every wrong answer by topic and redo weak topics in drill mode.
