import { useState } from 'react';
import { loadHistory } from '../attempt/history.ts';
import { combineTopics, TOPIC_LABELS } from '../attempt/score.ts';
import { MCQS } from '../content/bank.ts';
import { TOPICS } from '../content/schema.ts';
import {
  checkAnswer,
  chooseOption,
  drillQuestion,
  drillSummary,
  isCorrect,
  loadDrill,
  nextQuestion,
  retryQuestions,
  saveDrill,
  startDrill,
  type Drill,
} from '../practice/drill.ts';
import { Markdown } from './Markdown.tsx';

const WEAK_TOPIC_COUNT = 3;

function weakestTopics(): string[] {
  const entries = loadHistory().filter((entry) => !entry.assisted);
  return combineTopics(entries.slice(-5).map((entry) => entry.topics))
    .slice(0, WEAK_TOPIC_COUNT)
    .map((topic) => topic.topic);
}

function DrillSetup({ onStart }: { onStart: (drill: Drill) => void }) {
  const [topics, setTopics] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [weak] = useState(weakestTopics);
  const available = TOPICS.filter((topic) => MCQS.some((mcq) => mcq.topic === topic));

  return (
    <section className="mt-4">
      <p className="text-slate-700">
        Untimed multiple choice practice, with the answer and explanation after each question.
        Drills do not affect your score or your exam history.
      </p>
      <fieldset className="mt-4">
        <legend className="font-semibold">Topics</legend>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1"
            onClick={() => setTopics([...available])}
          >
            Select all
          </button>
          {weak.length > 0 && (
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1"
              onClick={() => setTopics(weak)}
            >
              My weakest topics
            </button>
          )}
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1"
            onClick={() => setTopics([])}
          >
            Clear
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {available.map((topic) => (
            <label key={topic} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={topics.includes(topic)}
                onChange={(event) =>
                  setTopics(
                    event.target.checked
                      ? [...topics, topic]
                      : topics.filter((other) => other !== topic),
                  )
                }
              />
              {TOPIC_LABELS[topic]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-4 block text-sm font-medium">
        Number of questions{' '}
        <select
          className="ml-1 rounded border border-slate-300 p-1"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
        >
          {[5, 10, 20, 50].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={topics.length === 0}
        className="mt-4 rounded bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
        onClick={() => onStart(startDrill(topics, count))}
      >
        Start drill
      </button>
    </section>
  );
}

function DrillQuestion({ drill, onChange }: { drill: Drill; onChange: (drill: Drill) => void }) {
  const id = drill.questionIds[drill.index]!;
  const mcq = drillQuestion(id)!;
  const answer = drill.answers[id] ?? { selected: [], checked: false };
  const correct = answer.checked && isCorrect(drill, mcq);

  return (
    <section className="mt-4">
      <p className="text-sm text-slate-600">
        Question {drill.index + 1} of {drill.questionIds.length}, {TOPIC_LABELS[mcq.topic]}
      </p>
      <div className="mt-2 rounded-lg border border-slate-200 p-5">
        <Markdown>{mcq.stem}</Markdown>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-600">
            {mcq.multiSelect ? 'Select all that apply' : 'Select one answer'}
          </legend>
          <div className="mt-2 space-y-2">
            {mcq.options.map((option, index) => {
              const isRight = mcq.correctIndexes.includes(index);
              return (
                <label
                  key={option}
                  className={`flex items-center gap-3 rounded border p-3 ${
                    answer.checked && isRight
                      ? 'border-emerald-600 bg-emerald-50'
                      : answer.selected.includes(index)
                        ? 'border-slate-500'
                        : 'border-slate-200'
                  }`}
                >
                  <input
                    type={mcq.multiSelect ? 'checkbox' : 'radio'}
                    name={mcq.id}
                    checked={answer.selected.includes(index)}
                    disabled={answer.checked}
                    onChange={() => onChange(chooseOption(drill, mcq, index))}
                  />
                  <span className="text-sm">{option}</span>
                  {answer.checked && isRight && (
                    <span className="ml-auto text-xs font-medium">✓ Correct answer</span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
        {answer.checked && (
          <div role="status" className="mt-4 rounded bg-slate-50 p-3">
            <p className="font-semibold">{correct ? '✓ Correct' : '✗ Not quite'}</p>
            <Markdown>{mcq.explanation}</Markdown>
          </div>
        )}
      </div>
      <div className="mt-4">
        {answer.checked ? (
          <button
            type="button"
            className="rounded bg-emerald-700 px-5 py-2 font-semibold text-white"
            onClick={() => onChange(nextQuestion(drill))}
          >
            {drill.index === drill.questionIds.length - 1 ? 'See results' : 'Next question'}
          </button>
        ) : (
          <button
            type="button"
            disabled={answer.selected.length === 0}
            className="rounded bg-emerald-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
            onClick={() => onChange(checkAnswer(drill, id))}
          >
            Check answer
          </button>
        )}
      </div>
    </section>
  );
}

function DrillResults({
  drill,
  onChange,
}: {
  drill: Drill;
  onChange: (drill: Drill | null) => void;
}) {
  const { total, correct, missedIds } = drillSummary(drill);
  return (
    <section className="mt-4">
      <h2 className="text-xl font-semibold">
        You got {correct} of {total} right
      </h2>
      <div className="mt-4 flex gap-2">
        {missedIds.length > 0 && (
          <button
            type="button"
            className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white"
            onClick={() => onChange(retryQuestions(missedIds))}
          >
            Retry the {missedIds.length} you missed
          </button>
        )}
        <button
          type="button"
          className="rounded border border-slate-300 px-4 py-2 font-medium"
          onClick={() => onChange(null)}
        >
          New drill
        </button>
      </div>
    </section>
  );
}

export function DrillScreen() {
  const [drill, setDrill] = useState<Drill | null>(loadDrill);
  const change = (next: Drill | null) => {
    saveDrill(next);
    setDrill(next);
  };

  return (
    <main className="mx-auto max-w-3xl px-8 pb-8 font-sans text-slate-900">
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Topic drill</h1>
        {drill && !drill.finished && (
          <button type="button" className="text-sm underline" onClick={() => change(null)}>
            End drill
          </button>
        )}
      </div>
      {!drill ? (
        <DrillSetup onStart={change} />
      ) : drill.finished ? (
        <DrillResults drill={drill} onChange={change} />
      ) : (
        <DrillQuestion drill={drill} onChange={change} />
      )}
    </main>
  );
}
