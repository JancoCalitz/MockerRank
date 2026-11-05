// The C# runtime worker. This is a plain script beside _framework, as in Microsoft's sample,
// rather than part of the Vite bundle, so dotnet.js can be a normal import.
// It speaks the protocol in src/runner/types.ts: WorkerRequest in, WorkerResponse out.
import { dotnet } from './_framework/dotnet.js';

const settings = new URL(self.location.href).searchParams;
const memoryLimitMb = Number(settings.get('memoryLimitMb'));
const outputLimit = Number(settings.get('outputLimit'));

// Libraries available to candidate code, as compiler references.
const REFERENCES = [
  'System.Private.CoreLib',
  'System.Runtime',
  'System.Console',
  'System.Collections',
  'System.Collections.Concurrent',
  'System.Collections.Immutable',
  'System.Collections.NonGeneric',
  'System.Collections.Specialized',
  'System.ComponentModel.Primitives',
  'System.Linq',
  'System.Linq.Expressions',
  'System.Memory',
  'System.ObjectModel',
  'System.Private.Uri',
  'System.Runtime.Extensions',
  'System.Runtime.Numerics',
  'System.Text.Json',
  'System.Text.RegularExpressions',
  'System.Threading',
  'System.Threading.Tasks',
  'netstandard',
];

// Counts the runtime's downloads, so the page can show progress. The same as trackDownloads in
// src/runner/download-progress.ts, which this plain script cannot import.
{
  const realFetch = self.fetch.bind(self);
  let loadedBytes = 0;
  let totalBytes = 0;
  let lastReported = 0;
  const report = () => self.postMessage({ kind: 'download', loadedBytes, totalBytes });
  self.fetch = async (...args) => {
    const response = await realFetch(...args);
    if (!response.ok || !response.body) return response;
    totalBytes += Number(response.headers.get('content-length') ?? 0);
    const [forCaller, forCounting] = response.body.tee();
    (async () => {
      const reader = forCounting.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          loadedBytes += value.length;
          if (loadedBytes - lastReported >= 524288) {
            lastReported = loadedBytes;
            report();
          }
        }
      } catch {
        // The caller sees the same failure on its own copy of the stream.
      }
      report();
    })();
    return new Response(forCaller, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

async function start() {
  const { getAssemblyExports, getConfig } = await dotnet
    .withEnvironmentVariable('MONO_GC_PARAMS', `max-heap-size=${memoryLimitMb}m`)
    .create();
  const exported = (await getAssemblyExports(getConfig().mainAssemblyName)).Runner;
  await exported.Init(new URL('./_framework/', self.location.href).href, REFERENCES);
  return exported;
}

const starting = start();

function handle(runner, { kind, source, stdin }) {
  if (kind === 'compile') {
    const errors = runner.Compile(source);
    return { kind: 'compiled', result: { ok: errors === '', output: errors } };
  }
  const started = performance.now();
  const result = JSON.parse(runner.Run(stdin, outputLimit));
  const timeMs = Math.round(performance.now() - started);
  return { kind: 'ran', result: { ...result, timeMs, memoryKb: null } };
}

// This must be set before anything is awaited, or the page's first message is lost.
self.onmessage = async ({ data }) => {
  try {
    self.postMessage(handle(await starting, data));
  } catch (error) {
    self.postMessage({ kind: 'failed', message: String(error?.message ?? error) });
  }
};
