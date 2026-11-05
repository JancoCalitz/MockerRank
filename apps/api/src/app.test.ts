import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { openDatabase } from './db.js';

// Nothing listens here, so connections are refused immediately.
const UNREACHABLE_JUDGE0 = 'http://127.0.0.1:9';

describe('GET /api/health', () => {
  let judge0: Server | undefined;

  afterEach(() => {
    judge0?.close();
    judge0 = undefined;
  });

  async function startFakeJudge0(): Promise<string> {
    const server = createServer((_request, response) => response.end('1.13.1'));
    judge0 = server;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it('is ok when every dependency is up', async () => {
    const app = buildApp({ db: openDatabase(':memory:'), judge0Url: await startFakeJudge0() });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      dependencies: { database: 'ok', judge0: 'ok' },
    });
  });

  it('stays ok but reports Judge0 when Judge0 is down', async () => {
    const app = buildApp({ db: openDatabase(':memory:'), judge0Url: UNREACHABLE_JUDGE0 });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      dependencies: { database: 'ok', judge0: 'unavailable' },
    });
  });

  it('returns 503 when the database is unusable', async () => {
    const db = openDatabase(':memory:');
    db.close();
    const app = buildApp({ db, judge0Url: UNREACHABLE_JUDGE0 });

    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'unavailable',
      dependencies: { database: 'unavailable' },
    });
  });
});
