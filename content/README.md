# Question bank

All questions must be original. Run `npm run content:validate` after any change.

| Folder    | Contents                                                |
| --------- | ------------------------------------------------------- |
| `mcq/`    | YAML files, each a list of multiple choice questions    |
| `coding/` | One YAML file per coding problem                        |
| `exams/`  | One YAML file per exam: 18 MCQ ids, 1 short, and 1 long |

Ids use lowercase words separated by hyphens, and must be unique across the whole bank. The schemas
in [`src/content/schema.ts`](../src/content/schema.ts) define every field.

## Multiple choice

Each question has exactly 4 options. `correctIndexes` counts from 0. Set `multiSelect: true` if a
question can have more than one correct answer.

## Coding problems

Each language a problem allows has a `starter`, and can have a `solution`. At least one language
needs a solution.

- **`style: stdin`:** the candidate writes the whole program, and `solution` is a whole program.
- **`style: function`:** the candidate writes a function, and `solution` is that function. Each
  language also needs a `harness`, a program that reads the input, calls the function, and prints
  the result. `{{USER_CODE}}` in the harness marks where the code goes.

Candidates can see `sampleTests`. `hiddenTests` have a `weight`, which defaults to 1. Use
`- file: name` for a large hidden test, which keeps it out of the app bundle and downloads it only on
submit. Its input and output go in `tests/name.in` and `tests/name.out`.

`timeLimitMs` and `memoryLimitMb` are optional, and override each language's defaults in
[`src/content/languages.ts`](../src/content/languages.ts).

`topics` is optional, and uses the same names as a multiple choice `topic`. It counts the problem in
topic performance on the results and progress pages.

### Checkers

| `checker.type`    | A test passes when                                             |
| ----------------- | -------------------------------------------------------------- |
| `exact`           | Output matches, ignoring line endings and trailing whitespace  |
| `token`           | The whitespace-separated tokens match                          |
| `float-tolerance` | Numbers are within `tolerance`, and other tokens match exactly |
| `custom`          | `script`, a JavaScript function body, returns `true`           |

A custom `script` receives `input`, `expected`, and `actual`.

## Exams

`proctoring` is optional. `requireFullscreen` ticks "Require full screen" on the start page by
default, and `warnAfterViolations` sets how many times a candidate can leave the test or full screen
before a warning appears. They default to `false` and 2.

`assistant` is optional. `maxMessagesPerQuestion` sets how many messages a candidate can send to the
AI assistant on each coding question, and defaults to 10.

`scoring` is also optional. These are its defaults:

```yaml
scoring:
  mcqWeight: 40
  shortWeight: 20
  longWeight: 40
  multiSelect: all-or-nothing # or partial
```

With `partial`, each correct choice earns a share of the point, and each wrong choice takes one share
away, down to no less than 0.

The start page also offers a random exam. `src/content/generate.ts` builds it from the bank, across
every topic and balancing difficulty, and avoids questions this browser has already seen until the
bank runs out of unseen ones.

## Question packs

A pack adds questions in a browser, without changing this folder. Import one under **Packs and backups**
in the app. It is a JSON or YAML file:

```yaml
format: mockerrank-pack
name: My questions
mcqs: [] # multiple choice questions, in the format above
problems: [] # coding problems, in the format above
exams: [] # exams, which can use questions from the pack and from the bank
```

Items identical to ones already in the browser are skipped, and a different item with an existing id
is an error. Packs cannot use `custom` checkers, because those run as code in the page. Imported solutions
are not run, so test a pack's problems before relying on them. To add questions for everyone, add them
to this folder instead, where validation runs their solutions.

## What validation checks

- Every file matches its schema, with unknown fields rejected.
- Ids are unique, and exams refer to questions that exist and are the right type.
- Reference solutions pass all of their own tests, within the time limit.

Validation runs JavaScript, TypeScript, and Python solutions on your machine, and lists any others
as not verified. Python is used only if it is installed. Each problem needs at least one solution
that can be run.
