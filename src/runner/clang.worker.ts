import { ConsoleStdout, File, OpenFile, WASI } from '@bjorn3/browser_wasi_shim';
import { OutputBuffer, OutputLimitError, type RunLimits, type RunStatus } from './types.ts';
import { hostRuntime } from './worker-host.ts';

const WASM_PAGE_BYTES = 65536;
const STACK_BYTES = 8 * 1024 * 1024;
const LINK_MEMORY_SLACK = 0.95;
const OUT_OF_MEMORY_MESSAGE = 'mockerrank: out of memory';

// Competitive programmers often include this GCC-only header, which Clang does not ship.
const BITS_STDCPP = [
  'algorithm',
  'array',
  'bitset',
  'cassert',
  'cctype',
  'climits',
  'cmath',
  'cstdint',
  'cstdio',
  'cstdlib',
  'cstring',
  'deque',
  'functional',
  'iomanip',
  'iostream',
  'iterator',
  'limits',
  'list',
  'map',
  'memory',
  'numeric',
  'queue',
  'set',
  'sstream',
  'stack',
  'string',
  'tuple',
  'type_traits',
  'unordered_map',
  'unordered_set',
  'utility',
  'vector',
]
  .map((header) => `#include <${header}>`)
  .join('\n');

// In WebAssembly, address 0 is ordinary writable memory. A program that ignores a failed
// malloc would not crash, and could run until the time limit, so failure stops it here.
const ALLOCATION_GUARD = `
#include <stddef.h>
#include <stdlib.h>
#include <unistd.h>
#ifdef __cplusplus
extern "C" {
#endif
void *__real_malloc(size_t);
void *__real_calloc(size_t, size_t);
void *__real_realloc(void *, size_t);
static void *guard(void *p, size_t size) {
  if (!p && size) {
    write(2, "${OUT_OF_MEMORY_MESSAGE}\\n", ${OUT_OF_MEMORY_MESSAGE.length + 1});
    _Exit(137);
  }
  return p;
}
void *__wrap_malloc(size_t n) { return guard(__real_malloc(n), n); }
void *__wrap_calloc(size_t n, size_t m) { return guard(__real_calloc(n, m), n * m); }
void *__wrap_realloc(void *p, size_t n) { return guard(__real_realloc(p, n), n); }
#ifdef __cplusplus
}
#endif
`;

type RunClang = (
  args: string[],
  files: Record<string, unknown>,
  options: { printLine: (line: string) => void },
) => Promise<Record<string, Uint8Array>>;

let runClang: RunClang | null = null;
let compiled: WebAssembly.Module | null = null;

const decoder = new TextDecoder();

function compileArgs(isCpp: boolean, limits: RunLimits): string[] {
  const pages = Math.ceil((limits.memoryLimitMb * 1024 * 1024) / WASM_PAGE_BYTES);
  const linker = [
    `-Wl,--max-memory=${pages * WASM_PAGE_BYTES}`,
    `-Wl,-z,stack-size=${STACK_BYTES}`,
    // A stack overflow then hits invalid memory and stops, instead of corrupting program data.
    '-Wl,--stack-first',
    '-Wl,--wrap=malloc,--wrap=calloc,--wrap=realloc',
  ];
  return isCpp
    ? [
        'clang++',
        '-O2',
        '-w',
        '-std=c++20',
        '-fno-exceptions',
        '-I.',
        'main.cc',
        'guard.cc',
        ...linker,
        '-o',
        'a.out',
      ]
    : ['clang', '-O2', '-w', '-std=c17', 'main.c', 'guard.c', ...linker, '-o', 'a.out'];
}

hostRuntime({
  async compile(source, limits, assetsUrl) {
    runClang ??= (await import(/* @vite-ignore */ `${assetsUrl}clang/bundle.js`))
      .runClang as RunClang;
    const isCpp = self.name === 'cpp';
    const files = isCpp
      ? { 'main.cc': source, 'guard.cc': ALLOCATION_GUARD, bits: { 'stdc++.h': BITS_STDCPP } }
      : { 'main.c': source, 'guard.c': ALLOCATION_GUARD };
    const log: string[] = [];
    try {
      const output = await runClang(compileArgs(isCpp, limits), files, {
        printLine: (line) => log.push(line),
      });
      compiled = await WebAssembly.compile(output['a.out'] as BufferSource);
      return { ok: true, output: '' };
    } catch (error) {
      return { ok: false, output: log.join('\n') || String(error) };
    }
  },
  async run(stdin, limits) {
    const stdout = new OutputBuffer();
    const stderr = new OutputBuffer();
    const fds = [
      new OpenFile(new File(new TextEncoder().encode(stdin))),
      new ConsoleStdout((bytes) => stdout.write(decoder.decode(bytes, { stream: true }))),
      new ConsoleStdout((bytes) => stderr.write(decoder.decode(bytes, { stream: true }))),
    ];
    const wasi = new WASI(['main'], [], fds, { debug: false });
    const instance = await WebAssembly.instantiate(compiled!, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });
    const memory = instance.exports.memory as WebAssembly.Memory;

    let status: RunStatus = 'ok';
    const started = performance.now();
    try {
      const code = wasi.start(instance as Parameters<WASI['start']>[0]);
      if (code !== 0) {
        status = stderr.toString().includes(OUT_OF_MEMORY_MESSAGE)
          ? 'memory-limit'
          : 'runtime-error';
      }
    } catch (error) {
      status = 'runtime-error';
      const limitBytes = limits.memoryLimitMb * 1024 * 1024;
      const nearLimit = memory.buffer.byteLength >= limitBytes * LINK_MEMORY_SLACK;
      if (error instanceof OutputLimitError) stderr.write(error.message);
      else if (nearLimit || /bad_alloc/.test(stderr.toString())) status = 'memory-limit';
      else stderr.write(`${String(error)}\n`);
    }

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      status,
      timeMs: Math.round(performance.now() - started),
      memoryKb: Math.round(memory.buffer.byteLength / 1024),
    };
  },
});
