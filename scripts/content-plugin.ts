// Turns the question bank's YAML files into JavaScript when the site is built. Everything but a
// coding problem's code loads with the page, and each problem's starters, harnesses, and solutions
// become a chunk of their own, loaded when someone opens that problem. A bad file stops the build.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { parse } from 'yaml';
import { z } from 'zod';
import { type CodingProblem, codingSchema, examSchema, mcqSchema } from '../src/content/schema.ts';

const BANK_ID = 'virtual:question-bank';
const CODE_PREFIX = 'virtual:problem-code/';
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

function bankModule(): string {
  const mcqs = yamlFiles('mcq').flatMap((path) => z.array(mcqSchema).parse(read(path)));
  const exams = yamlFiles('exams').map((path) => examSchema.parse(read(path)));
  const problems = parseProblems();
  const summaries = problems.map((problem) => ({ ...problem, languages: {} }));
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

function codeModule(id: string): string {
  const problem = parseProblems().find((candidate) => candidate.id === id);
  if (!problem) throw new Error(`No coding problem called ${id}.`);
  return `export default ${JSON.stringify(problem.languages)};`;
}

export function contentPlugin(): Plugin {
  return {
    name: 'mockerrank-content',
    resolveId(id) {
      return id === BANK_ID || id.startsWith(CODE_PREFIX) ? `\0${id}` : null;
    },
    load(id) {
      if (id === `\0${BANK_ID}`) {
        for (const folder of ['mcq', 'coding', 'exams']) {
          for (const path of yamlFiles(folder)) this.addWatchFile(resolve(path));
        }
        return bankModule();
      }
      if (id.startsWith(`\0${CODE_PREFIX}`)) return codeModule(id.slice(CODE_PREFIX.length + 1));
      return null;
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
