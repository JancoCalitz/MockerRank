// Turns the question bank's YAML files into JavaScript when the site is built. Everything but a
// coding problem's code loads with the page, and each problem's starters, harnesses, and solutions
// become a chunk of their own, loaded when someone opens that problem. A bad file stops the build.
//
// Built with a password, the whole bank, code included, becomes one encrypted file instead, and
// so does each large test file. The page then holds no question text at all until someone enters
// the password. See src/content/lock.ts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { parse } from 'yaml';
import { z } from 'zod';
import { deriveKey, encrypt } from '../src/content/crypto.ts';
import { type CodingProblem, codingSchema, examSchema, mcqSchema } from '../src/content/schema.ts';

const BANK_ID = 'virtual:question-bank';
const CODE_PREFIX = 'virtual:problem-code/';
const LOCK_ID = 'virtual:content-lock';
const LOCKED_FILE = 'content.bin';
const CONTENT = 'content';

function yamlFiles(folder: string): string[] {
  const dir = join(CONTENT, folder);
  return readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()
    .map((name) => join(dir, name));
}

const read = (path: string): unknown => parse(readFileSync(path, 'utf8'));

// Every problem's chunk reads from this list, so parse the files once rather than once per chunk.
let parsedProblems: CodingProblem[] | undefined;

function parseProblems(): CodingProblem[] {
  parsedProblems ??= yamlFiles('coding').map((path) => codingSchema.parse(read(path)));
  return parsedProblems;
}

function bankData() {
  const mcqs = yamlFiles('mcq').flatMap((path) => z.array(mcqSchema).parse(read(path)));
  const exams = yamlFiles('exams').map((path) => examSchema.parse(read(path)));
  const problems = parseProblems();
  const summaries = problems.map((problem) => ({ ...problem, languages: {} }));
  return { mcqs, exams, problems, summaries };
}

function bankModule(): string {
  const { mcqs, exams, problems, summaries } = bankData();
  const loaders = problems
    .map(({ id }) => `${JSON.stringify(id)}: () => import(${JSON.stringify(CODE_PREFIX + id)})`)
    .join(',\n');
  return [
    `export const mcqs = ${JSON.stringify(mcqs)};`,
    `export const problems = ${JSON.stringify(summaries)};`,
    `export const exams = ${JSON.stringify(exams)};`,
    `export const codeLoaders = {\n${loaders}\n};`,
  ].join('\n');
}

// A locked build reads the bank that src/content/lock.ts decrypted, so no question is in the code.
function lockedBankModule(): string {
  const lock = JSON.stringify(resolve('src/content/lock.ts').replaceAll('\\', '/'));
  return [
    `import { unlockedBank } from ${lock};`,
    'const bank = unlockedBank();',
    'export const mcqs = bank.mcqs;',
    'export const problems = bank.problems;',
    'export const exams = bank.exams;',
    'export const codeLoaders = Object.fromEntries(',
    '  Object.entries(bank.code).map(([id, languages]) => [id, async () => ({ default: languages })]),',
    ');',
  ].join('\n');
}

function codeModule(id: string): string {
  const problem = parseProblems().find((candidate) => candidate.id === id);
  if (!problem) throw new Error(`No coding problem called ${id}.`);
  return `export default ${JSON.stringify(problem.languages)};`;
}

// password: lock the built site with this password. Leave it out for an ordinary build.
export function contentPlugin({ password }: { password?: string } = {}): Plugin {
  let key: CryptoKey | undefined;
  let outDir = 'dist';
  return {
    name: 'mockerrank-content',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      if (password) key = await deriveKey(password);
    },
    resolveId(id) {
      return id === BANK_ID || id === LOCK_ID || id.startsWith(CODE_PREFIX) ? `\0${id}` : null;
    },
    load(id) {
      if (id === `\0${LOCK_ID}`) {
        const lock = { locked: Boolean(password), file: LOCKED_FILE };
        return `export const contentLock = ${JSON.stringify(lock)};`;
      }
      if (id === `\0${BANK_ID}`) {
        for (const folder of ['mcq', 'coding', 'exams']) {
          for (const path of yamlFiles(folder)) this.addWatchFile(resolve(path));
        }
        return password ? lockedBankModule() : bankModule();
      }
      if (id.startsWith(`\0${CODE_PREFIX}`)) {
        if (password) this.error('A locked build must not contain plain problem code.');
        return codeModule(id.slice(CODE_PREFIX.length + 1));
      }
      return null;
    },
    async generateBundle() {
      if (!key) return;
      const { mcqs, exams, problems, summaries } = bankData();
      const code = Object.fromEntries(problems.map((problem) => [problem.id, problem.languages]));
      const bank = JSON.stringify({ mcqs, problems: summaries, exams, code });
      const source = await encrypt(key, new TextEncoder().encode(bank));
      this.emitFile({ type: 'asset', fileName: LOCKED_FILE, source });
    },
    // The large tests reach the output as plain copies of public/tests, so encrypt them in place.
    async closeBundle() {
      const tests = join(outDir, 'tests');
      if (!key || !existsSync(tests)) return;
      for (const name of readdirSync(tests)) {
        const path = join(tests, name);
        writeFileSync(path, await encrypt(key, new Uint8Array(readFileSync(path))));
      }
    },
    configureServer(server) {
      const contentDir = resolve(CONTENT);
      server.watcher.add(contentDir);
      server.watcher.on('all', (_event, path) => {
        if (!resolve(path).startsWith(contentDir) || !/\.ya?ml$/.test(path)) return;
        parsedProblems = undefined;
        for (const module of server.moduleGraph.idToModuleMap.values()) {
          if (module.id?.startsWith('\0virtual:')) server.moduleGraph.invalidateModule(module);
        }
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
