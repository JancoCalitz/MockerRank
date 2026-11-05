import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db.js';

export interface AppDeps {
  db: Db;
  judge0Url: string;
  logger?: boolean;
}

export type DependencyStatus = 'ok' | 'unavailable';

const JUDGE0_TIMEOUT_MS = 2000;

function checkDatabase(db: Db): DependencyStatus {
  try {
    db.prepare('SELECT 1').get();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

async function checkJudge0(judge0Url: string): Promise<DependencyStatus> {
  try {
    const response = await fetch(new URL('/version', judge0Url), {
      signal: AbortSignal.timeout(JUDGE0_TIMEOUT_MS),
    });
    return response.ok ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function buildApp({ db, judge0Url, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  // Judge0 is reported but does not fail the check: the app stays usable without
  // it, and it can take a while to start after the rest of the stack.
  app.get('/api/health', async (_request, reply) => {
    const database = checkDatabase(db);
    const judge0 = await checkJudge0(judge0Url);
    const healthy = database === 'ok';
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'unavailable',
      dependencies: { database, judge0 },
    });
  });

  return app;
}
