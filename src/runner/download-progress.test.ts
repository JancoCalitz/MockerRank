// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadMessage,
  reportDownload,
  subscribeToDownloads,
  trackDownloads,
  type DownloadProgress,
} from './download-progress.ts';

const MB = 1024 * 1024;

describe('downloadMessage', () => {
  it('shows how much has arrived', () => {
    expect(downloadMessage({ loadedBytes: 40 * MB, totalBytes: 100 * MB })).toContain(
      '40 of 100 MB',
    );
  });

  it('shows nothing once finished, or when the size is unknown', () => {
    expect(downloadMessage({ loadedBytes: 100 * MB, totalBytes: 100 * MB })).toBeNull();
    expect(downloadMessage({ loadedBytes: 5 * MB, totalBytes: 0 })).toBeNull();
  });
});

describe('subscribeToDownloads', () => {
  it('stops calling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const stop = subscribeToDownloads(listener);

    reportDownload({ loadedBytes: 1, totalBytes: 2 });
    stop();
    reportDownload({ loadedBytes: 2, totalBytes: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('trackDownloads', () => {
  const realFetch = globalThis.fetch;

  // A worker's global object is called self, which plain Node does not have.
  beforeEach(() => vi.stubGlobal('self', globalThis));

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.unstubAllGlobals();
  });

  it('counts bytes across files, and returns each response intact', async () => {
    globalThis.fetch = vi.fn(
      async (url: string | URL | Request) =>
        new Response(url === 'a' ? 'hello' : 'worlds', {
          headers: {
            'content-length': url === 'a' ? '5' : '6',
            'content-type': 'application/wasm',
          },
        }),
    );
    const reports: DownloadProgress[] = [];
    trackDownloads((progress) => reports.push(progress));

    const first = await fetch('a');
    const second = await fetch('b');

    expect(await first.text()).toBe('hello');
    expect(first.headers.get('content-type')).toBe('application/wasm');
    expect(await second.text()).toBe('worlds');
    await vi.waitFor(() => expect(reports.at(-1)).toEqual({ loadedBytes: 11, totalBytes: 11 }));
  });

  it('leaves failed responses alone', async () => {
    const failure = new Response('nope', { status: 404 });
    globalThis.fetch = vi.fn(async () => failure);
    trackDownloads(() => {});

    expect(await fetch('a')).toBe(failure);
  });
});
