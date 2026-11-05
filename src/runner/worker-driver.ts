import type {
  CompileResult,
  RunLimits,
  RunResult,
  RuntimeDriver,
  WorkerRequest,
  WorkerResponse,
} from './types.ts';

import { reportDownload } from './download-progress.ts';

// Allows for downloading and starting a language the first time it is used.
const COMPILE_TIMEOUT_MS = 180_000;

export function assetsUrl(): string {
  return new URL('runtimes/', document.baseURI).href;
}

export class WorkerDriver implements RuntimeDriver {
  private worker: Worker | null = null;
  private source = '';
  private limits: RunLimits | null = null;
  private readonly createWorker: (limits: RunLimits) => Worker;

  constructor(createWorker: (limits: RunLimits) => Worker) {
    this.createWorker = createWorker;
  }

  private stopWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private send(
    request: WorkerRequest,
    timeoutMs: number,
  ): Promise<WorkerResponse | 'timeout' | 'crash'> {
    this.worker ??= this.createWorker(this.limits!);
    const worker = this.worker;
    return new Promise((resolve) => {
      const finish = (result: WorkerResponse | 'timeout' | 'crash') => {
        clearTimeout(timer);
        worker.onmessage = null;
        worker.onerror = null;
        resolve(result);
      };
      const timer = setTimeout(() => finish('timeout'), timeoutMs);
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (data.kind === 'download') reportDownload(data);
        else finish(data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        finish('crash');
      };
      worker.postMessage(request);
    });
  }

  async compile(source: string, limits: RunLimits): Promise<CompileResult> {
    this.source = source;
    this.limits = limits;
    const response = await this.send(
      { kind: 'compile', source, limits, assetsUrl: assetsUrl() },
      COMPILE_TIMEOUT_MS,
    );
    if (typeof response === 'object' && response.kind === 'compiled') return response.result;
    this.stopWorker();
    const reason =
      response === 'timeout'
        ? 'The compiler timed out.'
        : typeof response === 'object' && response.kind === 'failed'
          ? response.message
          : 'It may not have downloaded.';
    throw new Error(
      `Could not start this language. Check your internet connection, and try again. (${reason})`,
    );
  }

  async run(stdin: string, limits: RunLimits): Promise<RunResult> {
    // A previous program was terminated, so this needs a new worker with the program loaded.
    if (!this.worker) await this.compile(this.source, limits);

    const started = performance.now();
    const response = await this.send({ kind: 'run', stdin, limits }, limits.timeLimitMs);
    const timeMs = Math.round(performance.now() - started);

    if (typeof response === 'object' && response.kind === 'ran') return response.result;

    this.stopWorker();
    const base = { stdout: '', timeMs, memoryKb: null };
    if (response === 'timeout') return { ...base, stderr: '', status: 'time-limit' };
    if (response === 'crash') {
      return { ...base, stderr: 'The program crashed.', status: 'runtime-error' };
    }
    return {
      ...base,
      stderr: response.kind === 'failed' ? response.message : 'Unexpected runner response.',
      status: 'runtime-error',
    };
  }

  dispose(): void {
    this.stopWorker();
  }
}
