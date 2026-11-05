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

// Declares the parts of Node.js that candidates' programs can use, as the checker cannot see them.
const NODE_TYPES = `
declare const console: {
  log(...args: any[]): void;
  info(...args: any[]): void;
  debug(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
};
declare const process: any;
declare const module: any;
declare const exports: any;
declare function require(name: string): any;
declare function setTimeout(fn: (...args: any[]) => void, ms?: number, ...args: any[]): number;
declare function setInterval(fn: (...args: any[]) => void, ms?: number, ...args: any[]): number;
declare function clearTimeout(id?: number): void;
declare function clearInterval(id?: number): void;
declare module 'fs' { export function readFileSync(file: number | string, encoding?: any): string; }
declare module 'node:fs' { export function readFileSync(file: number | string, encoding?: any): string; }
declare module 'readline' { export function createInterface(options: any): any; }
declare module 'node:readline' { export function createInterface(options: any): any; }
`;

const MAIN_FILE = 'main.ts';
const TYPES_FILE = 'node-types.d.ts';
const STANDARD_LIB = 'lib.es2023.d.ts';

type Compile = (source: string) => { code: string; errors: string[] };

let compileTypeScript: Compile | null = null;

function baseName(path: string): string {
  return path.split('/').pop()!;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- The compiler is loaded at run time, untyped. */
function typeChecker(ts: any, libs: Record<string, string>) {
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: [STANDARD_LIB],
    types: [],
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
  };
  // Parsing the standard library is the slow part, and it never changes.
  const parsed = new Map<string, unknown>();

  return (source: string): string[] => {
    const textOf = (path: string): string | undefined => {
      const name = baseName(path);
      if (name === MAIN_FILE) return source;
      if (name === TYPES_FILE) return NODE_TYPES;
      return libs[name];
    };
    const host = {
      getSourceFile: (path: string, languageVersion: unknown) => {
        const name = baseName(path);
        if (name === MAIN_FILE) return ts.createSourceFile(path, source, languageVersion, true);
        if (!parsed.has(name)) {
          const text = textOf(name);
          if (text === undefined) return undefined;
          parsed.set(name, ts.createSourceFile(path, text, languageVersion, true));
        }
        return parsed.get(name);
      },
      getDefaultLibFileName: () => `/lib/${STANDARD_LIB}`,
      getDefaultLibLocation: () => '/lib',
      writeFile: () => {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: (name: string) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (path: string) => textOf(path) !== undefined,
      readFile: textOf,
      getDirectories: () => [],
    };
    const program = ts.createProgram([`/${MAIN_FILE}`, `/${TYPES_FILE}`], options, host);
    return ts
      .getPreEmitDiagnostics(program)
      .filter(
        (d: any) =>
          d.category === ts.DiagnosticCategory.Error && d.file?.fileName === `/${MAIN_FILE}`,
      )
      .map((d: any) => formatDiagnostic(ts, d));
  };
}

function formatDiagnostic(ts: any, d: any): string {
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (!d.file || d.start === undefined) return message;
  return `Line ${d.file.getLineAndCharacterOfPosition(d.start).line + 1}: ${message}`;
}

async function loadTypeScript(assetsUrl: string): Promise<Compile> {
  if (compileTypeScript) return compileTypeScript;
  const response = await fetch(`${assetsUrl}typescript/typescript.js`);
  const text = await response.text();
  const ts = new Function(`${text}\nreturn ts;`)() as any;
  const libsResponse = await fetch(`${assetsUrl}typescript/libs.json`);
  if (!libsResponse.ok) throw new Error('Could not download TypeScript’s type information.');
  const check = typeChecker(ts, (await libsResponse.json()) as Record<string, string>);

  compileTypeScript = (source) => {
    const output = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    // Syntax errors come first, as they would make the type errors confusing.
    const syntax = (output.diagnostics ?? []).map((d: any) => formatDiagnostic(ts, d));
    return {
      code: output.outputText as string,
      errors: syntax.length > 0 ? syntax : check(source),
    };
  };
  return compileTypeScript;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
