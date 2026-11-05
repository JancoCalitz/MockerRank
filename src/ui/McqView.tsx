import type { UpdateAttempt } from '../App.tsx';
import { clearSelection, selectOption, type Attempt } from '../attempt/attempt.ts';
import type { Mcq } from '../content/schema.ts';
import { Markdown } from './Markdown.tsx';

interface McqViewProps {
  attempt: Attempt;
  mcq: Mcq;
  update: UpdateAttempt;
}

export function McqView({ attempt, mcq, update }: McqViewProps) {
  const selected = attempt.mcq[mcq.id]?.selected ?? [];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
        <Markdown>{mcq.stem}</Markdown>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-slate-600">
            {mcq.multiSelect ? 'Select all that apply' : 'Select one answer'}
          </legend>
          <div className="mt-2 space-y-2">
            {mcq.options.map((option, index) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-3 rounded border p-3 ${
                  selected.includes(index)
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type={mcq.multiSelect ? 'checkbox' : 'radio'}
                  name={mcq.id}
                  checked={selected.includes(index)}
                  onChange={() =>
                    update((current) => selectOption(current, mcq.id, index, mcq.multiSelect))
                  }
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className="mt-4 text-sm text-slate-600 underline disabled:no-underline disabled:opacity-40"
          disabled={selected.length === 0}
          onClick={() => update((current) => clearSelection(current, mcq.id))}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
