import { BROWSER_MEMORY_MESSAGE, isBrowserMemoryFailure } from './browser-memory.ts';
import { findMainClass, instrumentJava, publicClassName } from './java-instrument.ts';
import {
  OUTPUT_LIMIT_BYTES,
  type CompileResult,
  type RunLimits,
  type RunResult,
  type RunStatus,
  type RuntimeDriver,
} from './types.ts';

const HARNESS_CLASSES = '/files/mockerrank-harness/';
const APP_CLASSES = '/files/mockerrank-app/';
const RESULTS = '/files/mockerrank-out/';
const JAVA_VERSION = 17;
const STOP_GRACE_MS = 5000;
// CheerpJ's allocator fails near 8 GB with an ArithmeticException, which looks just like a
// real divide by zero, because neither has a message. A real one rarely follows this much
// allocation, while a program that really ran out of memory always does.
const ALLOCATOR_FAILURE_BYTES = 4 * 1024 * 1024 * 1024;

// Added to candidate loops by instrumentJava. It stops the program at the time limit and
// regularly yields, so the page stays responsive while Java runs on its main thread.
const GUARD_SOURCE = `package mockerrank;
public final class G {
  public static final class Stop extends Error {}
  public static volatile String stopped;
  static long deadline, lastYield;
  static int ticks;
  public static void limits(long ms) { deadline = System.currentTimeMillis() + ms; stopped = null; ticks = 0; }
  public static boolean b() { t(); return true; }
  public static void t() { if ((++ticks & 0xFF) == 0) check(); }
  static void check() {
    long now = System.currentTimeMillis();
    if (stopped != null) throw new Stop();
    if (now > deadline) { stopped = "time-limit"; throw new Stop(); }
    if (now - lastYield >= 50) { lastYield = now; Thread.yield(); }
  }
}
`;

// Runs the candidate's main method with redirected input and output. A new class loader
// for each run gives each test its own static variables, without restarting the JVM.
const RUNNER_SOURCE = `package mockerrank;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
public final class Runner {
  static final class Limited extends ByteArrayOutputStream {
    final int limit;
    Limited(int limit) { this.limit = limit; }
    @Override public synchronized void write(byte[] b, int off, int len) {
      if (count + len > limit) { G.stopped = "output-limit"; throw new G.Stop(); }
      super.write(b, off, len);
    }
    @Override public synchronized void write(int b) {
      if (count + 1 > limit) { G.stopped = "output-limit"; throw new G.Stop(); }
      super.write(b);
    }
  }
  static void save(String path, byte[] bytes) throws IOException {
    try (FileOutputStream f = new FileOutputStream(path)) { f.write(bytes); }
  }
  public static void main(String[] a) throws Exception {
    String mainClass = a[0], classes = a[1], stdin = a[2], results = a[3];
    new File(results).mkdirs();
    int outputLimit = Integer.parseInt(a[5]);
    Limited out = new Limited(outputLimit), err = new Limited(outputLimit);
    System.setIn(new FileInputStream(stdin));
    System.setOut(new PrintStream(out, true));
    System.setErr(new PrintStream(err, true));
    G.limits(Long.parseLong(a[4]));
    String[] status = { "ok" };
    Thread finish = new Thread(() -> {
      try {
        System.out.flush(); System.err.flush();
        save(results + "stdout", out.toByteArray());
        save(results + "stderr", err.toByteArray());
        save(results + "status", (G.stopped != null ? G.stopped : status[0]).getBytes());
      } catch (IOException e) { e.printStackTrace(); }
    });
    Runtime.getRuntime().addShutdownHook(finish);
    try {
      URLClassLoader loader = new URLClassLoader(new URL[] { new File(classes).toURI().toURL() }, Runner.class.getClassLoader());
      Method main = loader.loadClass(mainClass).getMethod("main", String[].class);
      main.invoke(null, (Object) new String[0]);
    } catch (InvocationTargetException e) {
      Throwable t = e.getCause();
      if (t instanceof OutOfMemoryError) status[0] = "memory-limit";
      else if (!(t instanceof G.Stop)) {
        status[0] = "runtime-error";
        t.printStackTrace();
      }
    } catch (NoSuchMethodException | ClassNotFoundException e) {
      status[0] = "runtime-error";
      System.err.println("Could not find a main method: " + e.getMessage());
    }
    Runtime.getRuntime().removeShutdownHook(finish);
    finish.run();
  }
}
`;

interface CheerpWindow extends Window {
  cheerpjInit(options: object): Promise<void>;
  cheerpjRunMain(mainClass: string, classPath: string, ...args: string[]): Promise<number>;
  cheerpOSAddStringFile(path: string, content: string): void;
  cjFileBlob(path: string): Promise<Blob>;
  // Counted in java-frame.html.
  allocatedBytes: number;
}

interface JavaRuntime {
  frame: HTMLIFrameElement;
  window: CheerpWindow;
}

// Starting the JVM takes several seconds, so one stays running for the whole page.
let shared: Promise<JavaRuntime> | null = null;
let fileCounter = 0;

function stringFile(win: CheerpWindow, name: string, content: string): string {
  const path = `/str/${name}`;
  win.cheerpOSAddStringFile(path, content);
  return path;
}

function takeConsole(frame: HTMLIFrameElement): string {
  const element = frame.contentDocument!.getElementById('console')!;
  const text = element.textContent ?? '';
  element.textContent = '';
  return text.trim();
}

function javac(win: CheerpWindow, args: string[]): Promise<number> {
  return win.cheerpjRunMain('com.sun.tools.javac.Main', '', ...args);
}

async function startRuntime(): Promise<JavaRuntime> {
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  frame.src = new URL('java-frame.html', document.baseURI).href;
  const loaded = new Promise((resolve, reject) => {
    frame.onload = resolve;
    frame.onerror = reject;
  });
  document.body.append(frame);
  await loaded;
  const win = frame.contentWindow as CheerpWindow;
  if (typeof win.cheerpjInit !== 'function') {
    frame.remove();
    throw new Error('Could not load the Java runtime. Java needs an internet connection.');
  }
  await win.cheerpjInit({ status: 'none', version: JAVA_VERSION });

  const guard = stringFile(win, 'G.java', GUARD_SOURCE);
  const runner = stringFile(win, 'Runner.java', RUNNER_SOURCE);
  const code = await javac(win, ['-d', HARNESS_CLASSES, guard, runner]);
  if (code !== 0) throw new Error(`Could not build the Java harness: ${takeConsole(frame)}`);
  takeConsole(frame);
  return { frame, window: win };
}

function runtime(): Promise<JavaRuntime> {
  shared ??= startRuntime().catch((error: unknown) => {
    shared = null;
    throw error;
  });
  return shared;
}

// Removing the frame is the only way to reclaim its memory or stop a blocked program.
function stopRuntime({ frame }: JavaRuntime): void {
  frame.remove();
  shared = null;
}

// CheerpJ uses up the browser's WebAssembly memory after many programs in one page. Starting again
// with a fresh frame frees it, so a long session keeps working.
async function retryOnFreshRuntime<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (!isBrowserMemoryFailure((error as Error).message) || !shared) throw error;
    stopRuntime(await shared);
    try {
      return await task();
    } catch (retryError) {
      if (isBrowserMemoryFailure((retryError as Error).message)) {
        throw new Error(BROWSER_MEMORY_MESSAGE);
      }
      throw retryError;
    }
  }
}

function allocatorFailed(status: string, stderr: string, allocatedBytes: number): boolean {
  return (
    status === 'runtime-error' &&
    stderr.startsWith('java.lang.ArithmeticException') &&
    allocatedBytes >= ALLOCATOR_FAILURE_BYTES
  );
}

export class JavaDriver implements RuntimeDriver {
  private source = '';
  private mainClass = 'Main';

  compile(source: string): Promise<CompileResult> {
    return retryOnFreshRuntime(() => this.compileOnce(source));
  }

  run(stdin: string, limits: RunLimits): Promise<RunResult> {
    return retryOnFreshRuntime(() => this.runOnce(stdin, limits));
  }

  private async compileOnce(source: string): Promise<CompileResult> {
    const { frame, window: win } = await runtime();
    this.source = source;
    this.mainClass = findMainClass(source);
    const fileName = `${publicClassName(source) ?? this.mainClass.split('.').at(-1)}.java`;
    const compileFile = (content: string) =>
      javac(win, [
        '-nowarn',
        '-cp',
        HARNESS_CLASSES,
        '-d',
        APP_CLASSES,
        stringFile(win, fileName, content),
      ]);

    takeConsole(frame);
    if ((await compileFile(instrumentJava(source))) === 0) {
      takeConsole(frame);
      return { ok: true, output: '' };
    }
    // Compile the untouched code to show errors that match what the candidate wrote.
    takeConsole(frame);
    const code = await compileFile(source);
    const output = takeConsole(frame).replaceAll('/str/', '');
    return { ok: false, output: code === 0 ? 'Compilation failed.' : output };
  }

  private async runOnce(stdin: string, limits: RunLimits): Promise<RunResult> {
    // The previous program was stopped by removing the runtime, so load this one again.
    if (!shared) await this.compileOnce(this.source);
    const java = await runtime();
    const { window: win, frame } = java;
    const stdinPath = stringFile(win, `stdin-${++fileCounter}`, stdin);
    win.allocatedBytes = 0;

    const started = performance.now();
    const running = win
      .cheerpjRunMain(
        'mockerrank.Runner',
        HARNESS_CLASSES,
        this.mainClass,
        APP_CLASSES,
        stdinPath,
        RESULTS,
        String(limits.timeLimitMs),
        String(OUTPUT_LIMIT_BYTES),
      )
      .then(() => 'finished' as const);

    // The guard stops loops. This covers a program blocked some other way, such as sleeping.
    let timer = 0;
    const stuck = new Promise<'stuck'>((resolve) => {
      timer = window.setTimeout(() => resolve('stuck'), limits.timeLimitMs + STOP_GRACE_MS);
    });

    const outcome = await Promise.race([running, stuck]);
    clearTimeout(timer);
    const timeMs = Math.round(performance.now() - started);

    if (outcome === 'stuck') {
      stopRuntime(java);
      return { stdout: '', stderr: '', status: 'time-limit', timeMs, memoryKb: null };
    }

    const read = async (name: string) => (await win.cjFileBlob(RESULTS + name)).text();
    const stdout = await read('stdout');
    const stderr = await read('stderr');
    const saved = await read('status');
    const leftovers = takeConsole(frame);

    if (saved === 'output-limit') {
      return {
        stdout,
        stderr: 'Output limit exceeded',
        status: 'runtime-error',
        timeMs,
        memoryKb: null,
      };
    }
    return {
      stdout,
      stderr: stderr + leftovers,
      status: allocatorFailed(saved, stderr, win.allocatedBytes)
        ? 'memory-limit'
        : (saved as RunStatus),
      timeMs,
      memoryKb: null,
    };
  }

  // The JVM is shared between runs, so there is nothing to release here.
  dispose(): void {}
}
