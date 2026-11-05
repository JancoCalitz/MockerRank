import type {
  CompileResult,
  RunLimits,
  RunResult,
  WorkerRequest,
  WorkerResponse,
} from './types.ts';

export interface WorkerRuntime {
  compile(source: string, limits: RunLimits, assetsUrl: string): Promise<CompileResult>;
  run(stdin: string, limits: RunLimits): Promise<RunResult>;
}

// Connects a runtime to the page. The page times out and terminates the worker if a
// program runs too long, because code in a worker cannot be interrupted any other way.
export function hostRuntime(runtime: WorkerRuntime): void {
  self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
    let response: WorkerResponse;
    try {
      response =
        data.kind === 'compile'
          ? {
              kind: 'compiled',
              result: await runtime.compile(data.source, data.limits, data.assetsUrl),
            }
          : { kind: 'ran', result: await runtime.run(data.stdin, data.limits) };
    } catch (error) {
      response = { kind: 'failed', message: String((error as Error)?.message ?? error) };
    }
    self.postMessage(response);
  };
}
