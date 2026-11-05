export const OUTPUT_LIMIT_BYTES = 8 * 1024 * 1024;

export interface RunLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export type RunStatus = 'ok' | 'time-limit' | 'memory-limit' | 'runtime-error';

export interface RunResult {
  stdout: string;
  stderr: string;
  status: RunStatus;
  timeMs: number;
  // Null when the runtime cannot report it.
  memoryKb: number | null;
}

export interface CompileResult {
  ok: boolean;
  // Readable compiler errors when ok is false.
  output: string;
}

// One language's way of compiling a program once and running it against many inputs.
export interface RuntimeDriver {
  compile(source: string, limits: RunLimits): Promise<CompileResult>;
  run(stdin: string, limits: RunLimits): Promise<RunResult>;
  dispose(): void;
}

export type WorkerRequest =
  | { kind: 'compile'; source: string; limits: RunLimits; assetsUrl: string }
  | { kind: 'run'; stdin: string; limits: RunLimits };

export type WorkerResponse =
  | { kind: 'compiled'; result: CompileResult }
  | { kind: 'ran'; result: RunResult }
  | { kind: 'failed'; message: string };

// Collects program output and stops the program if it prints too much.
export class OutputBuffer {
  private parts: string[] = [];
  private size = 0;

  write(text: string): void {
    this.size += text.length;
    if (this.size > OUTPUT_LIMIT_BYTES) throw new OutputLimitError();
    this.parts.push(text);
  }

  toString(): string {
    return this.parts.join('');
  }
}

export class OutputLimitError extends Error {
  constructor() {
    super(`Output limit exceeded (${OUTPUT_LIMIT_BYTES / (1024 * 1024)} MB)`);
  }
}
