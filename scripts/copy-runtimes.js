// Copies language runtimes into public/runtimes, so they are served as static files
// locally and on GitHub Pages. That folder is generated, and git ignores it.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const OUT = 'public/runtimes';
const TYPESCRIPT_LIB = 'node_modules/typescript/lib';
const SOURCES = [
  ['node_modules/pyodide', 'pyodide', /\.(mjs|js|wasm|zip|json)$/],
  ['node_modules/@yowasp/clang/gen', 'clang', /./],
  ['node_modules/typescript/lib/typescript.js', 'typescript/typescript.js', /./],
  ['runners/csharp/publish', 'csharp', /./],
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [from, to, keep] of SOURCES) {
  if (!existsSync(from)) {
    console.warn(`Skipping ${to}: ${from} was not found.`);
    continue;
  }
  cpSync(from, `${OUT}/${to}`, {
    recursive: true,
    filter: (path) => path === from || keep.test(path) || !/\.[^/\\]+$/.test(path),
  });
}

// The standard library's type declarations, in one file, so TypeScript can check types in the
// browser without dozens of downloads.
if (existsSync(TYPESCRIPT_LIB)) {
  const libs = {};
  for (const name of readdirSync(TYPESCRIPT_LIB)) {
    if (/^lib\.(es|decorators).*\.d\.ts$/.test(name)) {
      libs[name] = readFileSync(`${TYPESCRIPT_LIB}/${name}`, 'utf8');
    }
  }
  writeFileSync(`${OUT}/typescript/libs.json`, JSON.stringify(libs));
}
