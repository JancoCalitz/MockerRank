import { OutputBuffer, OutputLimitError, type RunStatus } from './types.ts';
import { hostRuntime } from './worker-host.ts';

class ExitSignal {
  readonly code: number;
  constructor(code: number) {
    this.code = code;
  }
}

type Listener = (...args: unknown[]) => void;

let program: ((...args: unknown[]) => unknown) | null = null;

const PARAMETERS = [
  'require',
  'module',
  'exports',
  'process',
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
] as const;

function format(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.stack ?? String(value);
      if (typeof value === 'object' && value !== null) {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    })
    .join(' ');
}

// Runs one program with the parts of Node.js that assessment templates read input with.
function execute(stdin: string): Promise<{ stdout: string; stderr: string; status: RunStatus }> {
  const stdout = new OutputBuffer();
  const stderr = new OutputBuffer();

  return new Promise((resolve) => {
    let finished = false;
    let pendingTimers = 0;

    const finish = (status: RunStatus) => {
      if (finished) return;
      finished = true;
      self.removeEventListener('unhandledrejection', onRejection);
      resolve({ stdout: stdout.toString(), stderr: stderr.toString(), status });
    };

    const fail = (error: unknown) => {
      if (error instanceof ExitSignal) return finish(error.code === 0 ? 'ok' : 'runtime-error');
      if (error instanceof OutputLimitError) {
        stderr.write(error.message);
        return finish('runtime-error');
      }
      const message = String((error as Error)?.message ?? error);
      stderr.write(format([error]));
      finish(/allocation failed/i.test(message) ? 'memory-limit' : 'runtime-error');
    };

    const guarded =
      (fn: Listener): Listener =>
      (...args) => {
        try {
          fn(...args);
        } catch (error) {
          fail(error);
        }
      };

    const onRejection = (event: PromiseRejectionEvent) => fail(event.reason);
    self.addEventListener('unhandledrejection', onRejection);

    const listeners: Record<string, Listener[]> = {};
    const stdinStream = {
      setEncoding() {},
      resume() {},
      pause() {},
      on(event: string, listener: Listener) {
        (listeners[event] ??= []).push(listener);
        return stdinStream;
      },
    };

    const lineListeners: Record<string, Listener[]> = {};
    const readline = {
      createInterface() {
        const reader = {
          on(event: string, listener: Listener) {
            (lineListeners[event] ??= []).push(listener);
            return reader;
          },
          close() {},
        };
        return reader;
      },
    };

    const timers = new Map<number, boolean>();
    const untrack = (id: number) => {
      if (timers.delete(id)) pendingTimers--;
    };
    const timeout = (fn: Listener, ms?: number, ...args: unknown[]) => {
      pendingTimers++;
      const id: number = self.setTimeout(() => {
        untrack(id);
        guarded(fn)(...args);
      }, ms);
      timers.set(id, true);
      return id;
    };
    const interval = (fn: Listener, ms?: number, ...args: unknown[]) => {
      pendingTimers++;
      const id: number = self.setInterval(guarded(fn), ms, ...args);
      timers.set(id, true);
      return id;
    };
    const clear = (id: number) => {
      untrack(id);
      self.clearTimeout(id);
    };

    const fakeRequire = (name: string): unknown => {
      const bare = name.replace(/^node:/, '');
      if (bare === 'readline') return readline;
      if (bare === 'fs') {
        return {
          readFileSync(file: unknown) {
            if (file === 0 || file === '/dev/stdin') return stdin;
            throw new Error(`File access is not available: ${String(file)}`);
          },
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    };

    const write = (buffer: OutputBuffer) => (text: unknown) => {
      buffer.write(String(text));
      return true;
    };
    const logTo =
      (buffer: OutputBuffer) =>
      (...args: unknown[]) =>
        buffer.write(`${format(args)}\n`);

    const process = {
      stdin: stdinStream,
      stdout: { write: write(stdout) },
      stderr: { write: write(stderr) },
      argv: ['node', 'main'],
      env: {},
      exit(code = 0) {
        throw new ExitSignal(code);
      },
    };
    const console = {
      log: logTo(stdout),
      info: logTo(stdout),
      debug: logTo(stdout),
      error: logTo(stderr),
      warn: logTo(stderr),
    };

    const module = { exports: {} };
    try {
      program!(
        fakeRequire,
        module,
        module.exports,
        process,
        console,
        timeout,
        interval,
        clear,
        clear,
      );
    } catch (error) {
      fail(error);
    }

    // Deliver input the way Node.js does, after the program's first pass has finished.
    self.setTimeout(() => {
      if (finished) return;
      for (const listener of listeners.data ?? []) guarded(listener)(stdin);
      for (const listener of listeners.end ?? []) guarded(listener)();
      const lines = stdin.split('\n');
      if (lines.at(-1) === '') lines.pop();
      for (const line of lines) {
        for (const listener of lineListeners.line ?? []) guarded(listener)(line.replace(/\r$/, ''));
      }
      for (const listener of lineListeners.close ?? []) guarded(listener)();

      const waitForTimers = () => {
        if (finished) return;
        if (pendingTimers === 0) finish('ok');
        else self.setTimeout(waitForTimers, 5);
      };
      self.setTimeout(waitForTimers, 0);
    }, 0);
  });
}

let transpile: ((source: string) => { code: string; errors: string[] }) | null = null;

async function loadTypeScript(assetsUrl: string) {
  if (transpile) return transpile;
  const response = await fetch(`${assetsUrl}typescript/typescript.js`);
  const text = await response.text();
  const ts = new Function(`${text}\nreturn ts;`)();
  transpile = (source) => {
    const output = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const errors = (output.diagnostics ?? []).map(
      (d: {
        file?: { getLineAndCharacterOfPosition(p: number): { line: number } };
        start?: number;
        messageText: unknown;
      }) => {
        const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
        if (!d.file || d.start === undefined) return message;
        return `Line ${d.file.getLineAndCharacterOfPosition(d.start).line + 1}: ${message}`;
      },
    );
    return { code: output.outputText as string, errors };
  };
  return transpile;
}

hostRuntime({
  async compile(source, _limits, assetsUrl) {
    let code = source;
    if (self.name === 'typescript') {
      const result = (await loadTypeScript(assetsUrl))(source);
      if (result.errors.length > 0) return { ok: false, output: result.errors.join('\n') };
      code = result.code;
    }
    try {
      program = new Function(...PARAMETERS, code) as typeof program;
      return { ok: true, output: '' };
    } catch (error) {
      return { ok: false, output: String(error) };
    }
  },
  async run(stdin) {
    const started = performance.now();
    const result = await execute(stdin);
    return { ...result, timeMs: Math.round(performance.now() - started), memoryKb: null };
  },
});
