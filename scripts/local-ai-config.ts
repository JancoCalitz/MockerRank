import type { IncomingHttpHeaders } from 'node:http';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Decides what the local server tells a page about the AI key in .env. Only a page served from
// this computer gets it. The host check stops a website from reaching it through a DNS trick,
// and the others stop a website from reading it across origins.
export function localAiConfigResponse(
  headers: IncomingHttpHeaders,
  env: Record<string, string>,
): { status: number; body: string } {
  const host = headers.host ?? '';
  const site = headers['sec-fetch-site'];
  const origin = headers.origin;
  const sameOrigin = !origin || origin.replace(/^https?:\/\//, '') === host;
  if (!LOCAL_HOST.test(host) || !sameOrigin || (site && site !== 'same-origin')) {
    return { status: 403, body: 'null' };
  }
  if (!env.AI_API_KEY) return { status: 200, body: 'null' };
  return {
    status: 200,
    body: JSON.stringify({
      provider: env.AI_PROVIDER || 'anthropic',
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL ?? '',
      baseUrl: env.AI_BASE_URL ?? '',
    }),
  };
}
