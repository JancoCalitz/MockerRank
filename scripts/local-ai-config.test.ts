// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { localAiConfigResponse } from './local-ai-config.ts';

const env = { AI_API_KEY: 'key' };
const local = { host: 'localhost:8080', 'sec-fetch-site': 'same-origin' };

describe('localAiConfigResponse', () => {
  it('gives the key to a page on this computer', () => {
    const { status, body } = localAiConfigResponse(local, env);

    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({
      provider: 'anthropic',
      apiKey: 'key',
      model: '',
      baseUrl: '',
    });
  });

  it('accepts every local address form', () => {
    for (const host of ['127.0.0.1:8080', '[::1]:8080', 'localhost']) {
      expect(localAiConfigResponse({ host }, env).status).toBe(200);
    }
  });

  it('refuses other host names, which could be a DNS trick or the local network', () => {
    for (const host of ['evil.example', '192.168.1.5:8080', 'localhost.evil.example']) {
      const { status, body } = localAiConfigResponse({ host }, env);
      expect(status).toBe(403);
      expect(body).not.toContain('key');
    }
  });

  it('refuses another website reading it from the browser', () => {
    expect(localAiConfigResponse({ ...local, 'sec-fetch-site': 'cross-site' }, env).status).toBe(
      403,
    );
    expect(
      localAiConfigResponse({ host: 'localhost:8080', origin: 'https://evil.example' }, env).status,
    ).toBe(403);
  });

  it('reports no key when .env has none', () => {
    expect(localAiConfigResponse(local, {})).toEqual({ status: 200, body: 'null' });
    expect(localAiConfigResponse(local, { AI_API_KEY: '' }).body).toBe('null');
  });
});
