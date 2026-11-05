import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig } from './config.ts';
import { AssistantError, completionFor, type CompletionRequest } from './providers.ts';

const claude: AiConfig = {
  provider: 'anthropic',
  apiKey: 'sk-test',
  model: '',
  baseUrl: '',
  source: 'pasted',
};
const request: CompletionRequest = {
  purpose: 'reply',
  system: 'rules',
  messages: [{ role: 'user', content: 'hi' }],
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls[0]!;
  return {
    url: String(url),
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

const claudeReply = (text: string, stop_reason = 'end_turn') => ({
  id: 'msg',
  type: 'message',
  role: 'assistant',
  model: 'm',
  content: [
    { type: 'thinking', thinking: '', signature: 's' },
    { type: 'text', text },
  ],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
});

describe('Claude requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the key and the browser access header to Anthropic', async () => {
    const fetchMock = stubFetch(200, claudeReply('hello'));

    const result = await completionFor(claude)(request);

    expect(result).toEqual({ text: 'hello', refused: false });
    const { url, headers } = sentRequest(fetchMock);
    expect(url).toContain('https://api.anthropic.com/v1/messages');
    expect(headers.get('authorization')).toBe('Bearer sk-test');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
  });

  it('uses the default model and options for a reply', async () => {
    const fetchMock = stubFetch(200, claudeReply('hello'));

    await completionFor(claude)(request);

    expect(sentRequest(fetchMock).body).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'rules',
      fallbacks: 'default',
      output_config: { effort: 'low' },
    });
  });

  it('uses the lighter model for a check, with no fallback option', async () => {
    const fetchMock = stubFetch(200, claudeReply('NO'));

    await completionFor(claude)({ ...request, purpose: 'check' });

    const { body, headers } = sentRequest(fetchMock);
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.fallbacks).toBeUndefined();
    expect(headers.get('anthropic-beta') ?? '').not.toContain('server-side-fallback');
  });

  it('honours a chosen model, leaving out options an older one may reject', async () => {
    const fetchMock = stubFetch(200, claudeReply('hi'));

    await completionFor({ ...claude, model: 'claude-other' })(request);

    const { body } = sentRequest(fetchMock);
    expect(body.model).toBe('claude-other');
    expect(body.fallbacks).toBeUndefined();
    expect(body.output_config).toBeUndefined();
  });

  it('reports a refusal instead of reading the content', async () => {
    stubFetch(200, claudeReply('', 'refusal'));

    expect(await completionFor(claude)(request)).toEqual({ text: '', refused: true });
  });

  it('turns a rejected key into a readable error', async () => {
    stubFetch(401, { type: 'error', error: { type: 'authentication_error', message: 'x' } });

    const failure = await completionFor(claude)(request).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AssistantError);
    expect((failure as Error).message).toBe('Your provider rejected this API key.');
  });
});

describe('OpenAI-format requests', () => {
  const openai: AiConfig = { ...claude, provider: 'openai', model: 'some-model' };
  const reply = { choices: [{ message: { content: ' hello ' } }] };

  afterEach(() => vi.unstubAllGlobals());

  it('sends the key and puts the rules in a system message', async () => {
    const fetchMock = stubFetch(200, reply);

    expect(await completionFor(openai)(request)).toEqual({ text: 'hello', refused: false });

    const { url, headers, body } = sentRequest(fetchMock);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(headers.get('authorization')).toBe('Bearer sk-test');
    expect(body).toEqual({
      model: 'some-model',
      messages: [
        { role: 'system', content: 'rules' },
        { role: 'user', content: 'hi' },
      ],
    });
  });

  it('uses a compatible provider’s own URL, without doubling a slash', async () => {
    const fetchMock = stubFetch(200, reply);

    await completionFor({
      ...openai,
      provider: 'openai-compatible',
      baseUrl: 'https://example.com/v1/',
    })(request);

    expect(sentRequest(fetchMock).url).toBe('https://example.com/v1/chat/completions');
  });

  it('reports a refusal, and readable errors', async () => {
    stubFetch(200, { choices: [{ message: { content: null, refusal: 'no' } }] });
    expect((await completionFor(openai)(request)).refused).toBe(true);

    stubFetch(429, {});
    await expect(completionFor(openai)(request)).rejects.toThrow('rate limit');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('blocked');
      }),
    );
    await expect(completionFor(openai)(request)).rejects.toThrow('may not allow requests');
  });
});
