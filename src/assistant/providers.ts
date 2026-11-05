import type { AiConfig } from './config.ts';

export const ANTHROPIC_MODEL = 'claude-opus-5-5';
// The second, cheaper model that checks each reply. Other providers use their chosen model.
export const ANTHROPIC_CHECK_MODEL = 'claude-haiku-5-5';

// Models that accept these request options. A key holder can name any other model in .env,
// which may reject them.
const SUPPORTS_FALLBACKS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);
const SUPPORTS_EFFORT = new Set([...SUPPORTS_FALLBACKS, 'claude-haiku-5-5']);

const REPLY_MAX_TOKENS = 16000;
const CHECK_MAX_TOKENS = 1000;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatTurn[];
  purpose: 'reply' | 'check';
}

export interface Completion {
  text: string;
  // The provider declined to answer.
  refused: boolean;
}

export type Complete = (request: CompletionRequest) => Promise<Completion>;

export class AssistantError extends Error {}

function messageForStatus(status: number | undefined): string {
  if (status === 401 || status === 403) return 'Your provider rejected this API key.';
  if (status === 402) return 'Your provider account needs more credit.';
  if (status === 404) return 'Your provider does not recognise this model.';
  if (status === 429) return 'Your provider’s rate limit was reached. Wait a moment and try again.';
  if (status !== undefined && status >= 500) {
    return 'Your provider is having trouble. Try again in a moment.';
  }
  return `Your provider returned an error${status ? ` (${status})` : ''}.`;
}

async function completeWithClaude(
  config: AiConfig,
  { system, messages, purpose }: CompletionRequest,
): Promise<Completion> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Browser access is deliberate: each person uses their own key, on their own computer.
  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  const model =
    purpose === 'check' ? ANTHROPIC_CHECK_MODEL : config.model.trim() || ANTHROPIC_MODEL;
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: purpose === 'check' ? CHECK_MAX_TOKENS : REPLY_MAX_TOKENS,
      system,
      messages,
      ...(SUPPORTS_EFFORT.has(model) ? { output_config: { effort: 'low' as const } } : {}),
      ...(SUPPORTS_FALLBACKS.has(model)
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    });
    if (response.stop_reason === 'refusal') return { text: '', refused: true };
    const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
    return { text: text.join('\n').trim(), refused: false };
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AssistantError('Could not reach Anthropic. Check your internet connection.');
    }
    if (error instanceof Anthropic.APIError) {
      throw new AssistantError(messageForStatus(error.status));
    }
    throw error;
  }
}

// Other providers are reached through the widely used OpenAI chat completions format.
async function completeWithOpenAiFormat(
  config: AiConfig,
  { system, messages }: CompletionRequest,
): Promise<Completion> {
  const base = config.provider === 'openai' ? 'https://api.openai.com/v1' : config.baseUrl.trim();
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
  } catch {
    throw new AssistantError(
      'Could not reach your provider. It may not allow requests from a web page, or your internet connection may be down.',
    );
  }
  if (!response.ok) throw new AssistantError(messageForStatus(response.status));
  const data = (await response.json()) as {
    choices?: { message?: { content?: string; refusal?: string | null } }[];
  };
  const message = data.choices?.[0]?.message;
  return { text: (message?.content ?? '').trim(), refused: Boolean(message?.refusal) };
}

export function completionFor(config: AiConfig): Complete {
  return (request) =>
    config.provider === 'anthropic'
      ? completeWithClaude(config, request)
      : completeWithOpenAiFormat(config, request);
}
