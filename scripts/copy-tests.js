// Copies large test files into public/tests, so the app can fetch them when someone submits.
// They live outside the bundle because they are far too big to load with every page.
import { cpSync, existsSync, rmSync } from 'node:fs';

const OUT = 'public/tests';

rmSync(OUT, { recursive: true, force: true });
if (existsSync('content/tests')) cpSync('content/tests', OUT, { recursive: true });
