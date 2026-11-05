import { describe, expect, it, vi } from 'vitest';
import { codingSchema } from '../content/schema.ts';
import { configProblem } from './config.ts';
import {
  askAssistant,
  breaksLimits,
  FALLBACK_HINT,
  MAX_REPLY_CHARACTERS,
  REFUSED_REPLY,
  systemPrompt,
} from './policy.ts';
import type { Complete, CompletionRequest } from './providers.ts';

const problem = codingSchema.parse({
  id: 'p',
  title: 'Visible Title',
  type: 'short',
  style: 'stdin',
  difficulty: 'easy',
  statement: 'Visible statement',
  inputFormat: 'Visible input',
  outputFormat: 'Visible output',
  constraints: 'Visible constraints',
  sampleTests: [{ input: 'SAMPLEINPUT', output: 'SAMPLEOUTPUT' }],
  hiddenTests: [{ input: 'SECRETINPUT', output: 'SECRETOUTPUT' }],
  languages: { python: { starter: 'starter', solution: 'SECRETSOLUTION' } },
  checker: { type: 'exact' },
  editorial: 'SECRETEDITORIAL',
});

// Answers replies with the given texts in order, and checks with the given verdict.
function fakeModel(replies: string[], verdict: string | Error = 'NO') {
  const queue = [...replies];
  const requests: CompletionRequest[] = [];
  const complete: Complete = vi.fn(async (request: CompletionRequest) => {
    requests.push(request);
    if (request.purpose === 'check') {
      if (verdict instanceof Error) throw verdict;
      return { text: verdict, refused: false };
    }
    return { text: queue.shift() ?? '', refused: false };
  });
  return { complete, requests };
}

const ask = (complete: Complete, history = []) =>
  askAssistant(complete, problem, 'python', 'my code', history, 'Give me a hint');

describe('systemPrompt', () => {
  it('includes the problem, the candidate’s code, and the rules', () => {
    const prompt = systemPrompt(problem, 'python', 'my code');

    for (const text of ['Visible statement', 'Visible constraints', 'my code', 'Python 3']) {
      expect(prompt).toContain(text);
    }
    expect(prompt).toContain('Never give a complete solution');
    expect(prompt).toContain('Do not answer multiple choice questions');
  });

  it('never includes hidden tests, the editorial, or solutions', () => {
    const prompt = systemPrompt(problem, 'python', 'my code');

    expect(prompt).not.toMatch(/SECRET/);
  });
});

describe('breaksLimits', () => {
  it('allows a short reply with a small snippet', () => {
    expect(breaksLimits('Try a hash map:\n```python\ncounts = {}\ncounts[x] = 1\n```')).toBe(false);
  });

  it('rejects a reply that is too long', () => {
    expect(breaksLimits('x'.repeat(MAX_REPLY_CHARACTERS + 1))).toBe(true);
  });

  it('counts code across every block, and in a block left unclosed', () => {
    const lines = Array.from({ length: 4 }, (_, i) => `line${i}`).join('\n');
    expect(breaksLimits(`\`\`\`\n${lines}\n\`\`\`\ntext\n\`\`\`\n${lines}\n\`\`\``)).toBe(true);
    const many = Array.from({ length: 7 }, (_, i) => `line${i}`).join('\n');
    expect(breaksLimits(`\`\`\`\n${many}`)).toBe(true);
  });
});

describe('askAssistant', () => {
  it('passes on a reply the check approves', async () => {
    const { complete, requests } = fakeModel(['Think about hashing.']);

    expect(await ask(complete)).toEqual({ text: 'Think about hashing.', blocked: false });
    expect(requests.map((request) => request.purpose)).toEqual(['reply', 'check']);
  });

  it('sends earlier turns along with the new question', async () => {
    const { complete, requests } = fakeModel(['ok']);
    const history = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
    ] as never[];

    await ask(complete, history);

    expect(requests[0]!.messages.map((turn) => turn.content)).toEqual([
      'first',
      'answer',
      'Give me a hint',
    ]);
  });

  it('replaces a reply the check says gives away the solution', async () => {
    const { complete, requests } = fakeModel(['Here is the answer', 'Think about sorting.'], 'YES');

    expect(await ask(complete)).toEqual({ text: 'Think about sorting.', blocked: true });
    expect(requests[2]!.system).toContain('no code at all');
    expect(JSON.stringify(requests[2]!.messages)).not.toContain('Here is the answer');
  });

  it('replaces a reply over the limits without spending a check on it', async () => {
    const code = `\`\`\`python\n${'x = 1\n'.repeat(30)}\`\`\``;
    const { complete, requests } = fakeModel([code, 'A smaller hint.']);

    expect(await ask(complete)).toEqual({ text: 'A smaller hint.', blocked: true });
    expect(requests.some((request) => request.purpose === 'check')).toBe(false);
  });

  it('blocks when the check fails or gives an unclear answer', async () => {
    const failed = fakeModel(['reply', 'hint'], new Error('network'));
    expect((await ask(failed.complete)).blocked).toBe(true);

    const unclear = fakeModel(['reply', 'hint'], 'Perhaps');
    expect((await ask(unclear.complete)).blocked).toBe(true);
  });

  it('does not read "not sure" or "nope, wait: yes" style text as a clear no', async () => {
    const unsure = fakeModel(['reply', 'hint'], 'Not sure');
    expect((await ask(unsure.complete)).blocked).toBe(true);
  });

  it('accepts a no in any letter case or with punctuation', async () => {
    const lower = fakeModel(['reply'], 'no.');
    expect((await ask(lower.complete)).blocked).toBe(false);
  });

  it('uses a fixed hint if the replacement also has code or breaks the limits', async () => {
    const coded = fakeModel(['first', '```\ncode\n```'], 'YES');
    expect(await ask(coded.complete)).toEqual({ text: FALLBACK_HINT, blocked: true });

    const empty = fakeModel(['first', ''], 'YES');
    expect(await ask(empty.complete)).toEqual({ text: FALLBACK_HINT, blocked: true });
  });

  it('uses a fixed hint if the replacement request fails', async () => {
    let calls = 0;
    const complete: Complete = async (request) => {
      if (request.purpose === 'check') return { text: 'YES', refused: false };
      if (++calls === 2) throw new Error('down');
      return { text: 'first', refused: false };
    };

    expect(await ask(complete)).toEqual({ text: FALLBACK_HINT, blocked: true });
  });

  it('treats an empty reply as blocked', async () => {
    const { complete } = fakeModel(['', 'A hint.']);

    expect(await ask(complete)).toEqual({ text: 'A hint.', blocked: true });
  });

  it('explains a provider refusal without running a check', async () => {
    const complete = vi.fn(async () => ({ text: '', refused: true }));

    expect(await ask(complete)).toEqual({ text: REFUSED_REPLY, blocked: false });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('lets provider errors reach the panel', async () => {
    const complete = vi.fn(async () => {
      throw new Error('bad key');
    });

    await expect(ask(complete)).rejects.toThrow('bad key');
  });
});

describe('configProblem', () => {
  const base = { provider: 'anthropic' as const, apiKey: 'k', model: '', baseUrl: '' };

  it('needs only a key for Claude', () => {
    expect(configProblem(base)).toBeNull();
    expect(configProblem({ ...base, apiKey: ' ' })).toContain('API key');
  });

  it('needs a model name for other providers, as defaults there would be a guess', () => {
    expect(configProblem({ ...base, provider: 'openai' })).toContain('model');
    expect(configProblem({ ...base, provider: 'openai', model: 'm' })).toBeNull();
  });

  it('needs a URL for other OpenAI-compatible providers', () => {
    const custom = { ...base, provider: 'openai-compatible' as const, model: 'm' };
    expect(configProblem(custom)).toContain('URL');
    expect(configProblem({ ...custom, baseUrl: 'https://example.com/v1' })).toBeNull();
  });
});
