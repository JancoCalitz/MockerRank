export type AiProvider = 'anthropic' | 'openai' | 'openai-compatible';

export interface AiConfig {
  provider: AiProvider;
  apiKey: string;
  // Required except for Anthropic, where it defaults to the current recommended model.
  model: string;
  baseUrl: string;
  // Where the key came from, so the panel can say so.
  source: 'env' | 'pasted';
}

const SESSION_KEY = 'mockerrank.ai';

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
  'openai-compatible': 'Another OpenAI-compatible provider',
};

export function configProblem(config: Omit<AiConfig, 'source'>): string | null {
  if (!config.apiKey.trim()) return 'Enter your API key.';
  if (config.provider !== 'anthropic' && !config.model.trim()) {
    return 'Enter the model name your provider uses.';
  }
  if (config.provider === 'openai-compatible' && !config.baseUrl.trim()) {
    return 'Enter your provider’s API URL.';
  }
  return null;
}

function isProvider(value: unknown): value is AiProvider {
  return value === 'anthropic' || value === 'openai' || value === 'openai-compatible';
}

// The app's local server offers the key from .env. A published site has no such endpoint, and
// a static host may answer with its normal page, so anything but valid JSON means no key.
async function loadFromEnv(): Promise<AiConfig | null> {
  try {
    const response = await fetch(new URL('__local/ai-config', document.baseURI));
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, string> | null;
    if (!data) return null;
    const provider = isProvider(data.provider) ? data.provider : 'anthropic';
    const config = {
      provider,
      apiKey: data.apiKey ?? '',
      model: data.model ?? '',
      baseUrl: data.baseUrl ?? '',
    };
    return configProblem(config) ? null : { ...config, source: 'env' };
  } catch {
    return null;
  }
}

export function loadPastedConfig(): AiConfig | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as AiConfig | null;
    return saved && isProvider(saved.provider) && !configProblem(saved) ? saved : null;
  } catch {
    return null;
  }
}

// A pasted key lasts for this browser session only, so it is gone when the browser closes.
export function savePastedConfig(config: AiConfig | null): void {
  if (config) sessionStorage.setItem(SESSION_KEY, JSON.stringify(config));
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function loadConfig(): Promise<AiConfig | null> {
  return loadPastedConfig() ?? (await loadFromEnv());
}
