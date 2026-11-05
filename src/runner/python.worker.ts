import { OUTPUT_LIMIT_BYTES, type RunStatus } from './types.ts';
import { hostRuntime } from './worker-host.ts';

interface Pyodide {
  runPython(code: string, options?: { globals?: unknown }): unknown;
  globals: { get(name: string): (...args: unknown[]) => string };
  _module: { HEAP8: Int8Array };
}

const DRIVER = `
import io, json, sys, traceback

class _LimitedOutput(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > ${OUTPUT_LIMIT_BYTES}:
            raise OverflowError('Output limit exceeded')
        return super().write(text)

_compiled = None

def _compile(source):
    global _compiled
    try:
        _compiled = compile(source, 'main.py', 'exec')
        return ''
    except (SyntaxError, ValueError) as error:
        return ''.join(traceback.format_exception_only(type(error), error))

def _run(stdin):
    out, err = _LimitedOutput(), _LimitedOutput()
    real = sys.stdin, sys.stdout, sys.stderr
    sys.stdin, sys.stdout, sys.stderr = io.StringIO(stdin), out, err
    status = 'ok'
    try:
        exec(_compiled, {'__name__': '__main__'})
    except SystemExit as error:
        if error.code not in (None, 0):
            status = 'runtime-error'
    except MemoryError:
        status = 'memory-limit'
    except BaseException:
        status = 'runtime-error'
        err.write(traceback.format_exc())
    finally:
        sys.stdin, sys.stdout, sys.stderr = real
    return json.dumps({'stdout': out.getvalue(), 'stderr': err.getvalue(), 'status': status})
`;

let pyodide: Pyodide | null = null;

async function loadRuntime(assetsUrl: string): Promise<Pyodide> {
  if (pyodide) return pyodide;
  const indexURL = `${assetsUrl}pyodide/`;
  const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`);
  pyodide = (await loadPyodide({ indexURL })) as Pyodide;
  pyodide.runPython(DRIVER);
  return pyodide;
}

hostRuntime({
  async compile(source, _limits, assetsUrl) {
    const runtime = await loadRuntime(assetsUrl);
    const errors = runtime.globals.get('_compile')(source);
    return { ok: errors === '', output: errors };
  },
  async run(stdin, limits) {
    const runtime = pyodide!;
    const started = performance.now();
    const result = JSON.parse(runtime.globals.get('_run')(stdin)) as {
      stdout: string;
      stderr: string;
      status: RunStatus;
    };
    const timeMs = Math.round(performance.now() - started);
    const memoryKb = Math.round(runtime._module.HEAP8.length / 1024);
    // WebAssembly memory only grows, so this catches a program that went over at any point.
    const overLimit = memoryKb > limits.memoryLimitMb * 1024;
    return { ...result, status: overLimit ? 'memory-limit' : result.status, timeMs, memoryKb };
  },
});
