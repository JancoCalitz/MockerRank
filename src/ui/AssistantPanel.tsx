import { useEffect, useRef, useState } from 'react';
import type { UpdateAttempt } from '../App.tsx';
import {
  appendChat,
  assistantMessagesLeft,
  chatFor,
  type Attempt,
  type ChatEntry,
} from '../attempt/attempt.ts';
import {
  configProblem,
  loadConfig,
  PROVIDER_LABELS,
  savePastedConfig,
  type AiConfig,
  type AiProvider,
} from '../assistant/config.ts';
import { askAssistant, MAX_QUESTION_CHARACTERS, type AssistantReply } from '../assistant/policy.ts';
import { ANTHROPIC_MODEL, AssistantError, completionFor } from '../assistant/providers.ts';
import type { LanguageId } from '../content/languages.ts';
import type { CodingProblem } from '../content/schema.ts';
import { Markdown } from './Markdown.tsx';

function exchange(question: string, reply: AssistantReply): ChatEntry[] {
  const at = Date.now();
  return [
    { role: 'user', text: question, at },
    { role: 'assistant', text: reply.text, at, blocked: reply.blocked },
  ];
}

function KeyForm({ onSave }: { onSave: (config: AiConfig) => void }) {
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [problem, setProblem] = useState('');
  const fieldClass = 'mt-0.5 block w-full rounded border border-slate-300 p-1 text-sm';

  return (
    <form
      className="max-w-md space-y-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        const config = { provider, apiKey: apiKey.trim(), model, baseUrl };
        const issue = configProblem(config);
        if (issue) return setProblem(issue);
        const saved: AiConfig = { ...config, source: 'pasted' };
        savePastedConfig(saved);
        onSave(saved);
      }}
    >
      <p className="text-sm">The assistant uses your own API key.</p>
      <label className="block font-medium">
        Provider
        <select
          className={fieldClass}
          value={provider}
          onChange={(event) => setProvider(event.target.value as AiProvider)}
        >
          {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-medium">
        API key
        <input
          type="password"
          autoComplete="off"
          className={fieldClass}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <label className="block font-medium">
        Model
        <input
          className={fieldClass}
          placeholder={provider === 'anthropic' ? ANTHROPIC_MODEL : 'Required'}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      {provider === 'openai-compatible' && (
        <label className="block font-medium">
          API URL
          <input
            className={fieldClass}
            placeholder="https://example.com/v1"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </label>
      )}
      {problem && (
        <p role="alert" className="text-red-700">
          {problem}
        </p>
      )}
      <button type="submit" className="rounded bg-emerald-700 px-3 py-1 font-semibold text-white">
        Use this key
      </button>
      <p className="text-slate-600">
        Your key stays in this browser until you close it, and is only sent to your provider. Each
        message uses your provider account. When running locally, you can put the key in the .env
        file instead.
      </p>
    </form>
  );
}

interface AssistantPanelProps {
  attempt: Attempt;
  problem: CodingProblem;
  language: LanguageId;
  code: string;
  maxMessages: number;
  update: UpdateAttempt;
}

export function AssistantPanel({
  attempt,
  problem,
  language,
  code,
  maxMessages,
  update,
}: AssistantPanelProps) {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadConfig().then((loaded) => {
      if (!active) return;
      setConfig(loaded);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const chat = chatFor(attempt, problem.id);
  const end = useRef<HTMLDivElement>(null);

  // Keeps the newest message and the message box in view.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [chat.length, pending]);
  const left = assistantMessagesLeft(attempt, problem.id, maxMessages);

  if (loading) return <p className="text-sm text-slate-600">Loading…</p>;
  if (!config) return <KeyForm onSave={setConfig} />;

  const send = async () => {
    const text = question.trim();
    // Checked here too, not just on the button, as the count is the actual limit.
    if (!text || pending || assistantMessagesLeft(attempt, problem.id, maxMessages) <= 0) return;
    setPending(text);
    setQuestion('');
    setError('');
    try {
      const reply = await askAssistant(
        completionFor(config),
        problem,
        language,
        code,
        chat.map(({ role, text: content }) => ({ role, content })),
        text,
      );
      // A failed request is not logged, and does not use up a message.
      const entries = exchange(text, reply);
      update((current) => appendChat(current, problem.id, entries));
    } catch (failure) {
      setQuestion(text);
      setError(
        failure instanceof AssistantError
          ? failure.message
          : 'Something went wrong while asking the assistant.',
      );
    } finally {
      setPending('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          {left} of {maxMessages} messages left for this question. Hints only, not solutions.
        </span>
        {config.source === 'pasted' && (
          <button
            type="button"
            className="underline"
            onClick={() => {
              savePastedConfig(null);
              setConfig(null);
            }}
          >
            Remove key
          </button>
        )}
      </div>

      <ul aria-label="Conversation" className="space-y-2">
        {chat.map((entry, index) => (
          <li
            key={index}
            className={`rounded p-2 text-sm ${entry.role === 'user' ? 'bg-slate-100' : 'border border-slate-200'}`}
          >
            <p className="text-xs font-medium text-slate-600">
              {entry.role === 'user' ? 'You' : 'Assistant'}
            </p>
            <Markdown>{entry.text}</Markdown>
          </li>
        ))}
        {pending && (
          <li className="rounded bg-slate-100 p-2 text-sm">
            <p className="text-xs font-medium text-slate-600">You</p>
            <Markdown>{pending}</Markdown>
          </li>
        )}
      </ul>

      <div role="status" className="text-xs text-slate-600">
        {pending && 'The assistant is thinking…'}
      </div>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {left > 0 ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <label className="flex-1 text-xs font-medium text-slate-600">
            Ask for a hint
            <textarea
              className="mt-0.5 block h-14 w-full rounded border border-slate-300 p-1 text-sm"
              maxLength={MAX_QUESTION_CHARACTERS}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={Boolean(pending) || !question.trim()}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="text-sm font-medium">You have used all of your messages for this question.</p>
      )}
      <div ref={end} />
    </div>
  );
}
