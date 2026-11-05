export interface DownloadProgress {
  loadedBytes: number;
  totalBytes: number;
}

type Listener = (progress: DownloadProgress) => void;

const listeners = new Set<Listener>();

export function subscribeToDownloads(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportDownload(progress: DownloadProgress): void {
  for (const listener of listeners) listener(progress);
}

const REPORT_EVERY_BYTES = 512 * 1024;

// Runs in a worker. Language runtimes fetch large files from inside their own code, so this
// wraps fetch to count the bytes as they arrive, and passes each response on unchanged.
export function trackDownloads(report: Listener): void {
  const realFetch = self.fetch.bind(self);
  let loadedBytes = 0;
  let totalBytes = 0;
  let lastReported = 0;

  self.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await realFetch(...args);
    if (!response.ok || !response.body) return response;
    totalBytes += Number(response.headers.get('content-length') ?? 0);
    const [forCaller, forCounting] = response.body.tee();
    void (async () => {
      const reader = forCounting.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          loadedBytes += value.length;
          if (loadedBytes - lastReported >= REPORT_EVERY_BYTES) {
            lastReported = loadedBytes;
            report({ loadedBytes, totalBytes });
          }
        }
      } catch {
        // The caller sees the same failure on its own copy of the stream.
      }
      report({ loadedBytes, totalBytes });
    })();
    return new Response(forCaller, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

// What to show the candidate, or null once there is nothing left to wait for.
export function downloadMessage({ loadedBytes, totalBytes }: DownloadProgress): string | null {
  const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));
  // Compressed responses report a smaller total than the bytes that arrive, so this can pass it.
  if (loadedBytes >= totalBytes || totalBytes === 0) return null;
  return `Downloading this language, ${megabytes(loadedBytes)} of ${megabytes(totalBytes)} MB. It stays in your browser for next time.`;
}
