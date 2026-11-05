// Copies language runtimes into public/runtimes, so they are served as static files
// locally and on GitHub Pages. That folder is generated, and git ignores it.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const OUT = 'public/runtimes';
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
