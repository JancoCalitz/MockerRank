import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LanguageId } from '../../src/content/languages.ts';

export interface ReferenceResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
  exitCode: number | null;
}

interface LocalRuntime {
  file: string;
  command: string;
  args: string[];
}

function findPython(): string | undefined {
  return ['python3', 'python'].find((command) => {
    const check = spawnSync(command, ['--version'], { encoding: 'utf8' });
    return check.status === 0 && check.stdout.startsWith('Python 3');
  });
}

// Reference solutions are this project's own trusted content, so the validator runs
// them directly with what the machine has. Candidate code only ever runs in the browser.
export function detectRuntimes(): Partial<Record<LanguageId, LocalRuntime>> {
  const node = process.execPath;
  const python = findPython();
  return {
    javascript: { file: 'main.cjs', command: node, args: [] },
    typescript: {
      file: 'main.ts',
      command: node,
      args: ['--disable-warning=ExperimentalWarning'],
    },
    ...(python ? { python: { file: 'main.py', command: python, args: [] } } : {}),
  };
}

export function runReference(
  runtime: LocalRuntime,
  source: string,
  stdin: string,
  timeoutMs: number,
): ReferenceResult {
  const dir = mkdtempSync(join(tmpdir(), 'mockerrank-'));
  try {
    const path = join(dir, runtime.file);
    writeFileSync(path, source);
    const result = spawnSync(runtime.command, [...runtime.args, path], {
      input: stdin,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      timedOut: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
      exitCode: result.status,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
