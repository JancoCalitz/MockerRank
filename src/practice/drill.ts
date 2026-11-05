import { scoreMcq } from '../attempt/score.ts';
import { MCQS } from '../content/bank.ts';
import type { Mcq } from '../content/schema.ts';

const DRILL_KEY = 'mockerrank.drill';

export interface DrillAnswer {
  selected: number[];
  checked: boolean;
}

export interface Drill {
  questionIds: string[];
  index: number;
  answers: Record<string, DrillAnswer>;
  finished: boolean;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function drillQuestion(id: string | undefined): Mcq | undefined {
  return MCQS.find((mcq) => mcq.id === id);
}

export function startDrill(
  topics: readonly string[],
  count: number,
  random: () => number = Math.random,
): Drill {
  const pool = MCQS.filter((mcq) => topics.includes(mcq.topic));
  return {
    questionIds: shuffled(pool, random)
      .slice(0, count)
      .map((mcq) => mcq.id),
    index: 0,
    answers: {},
    finished: false,
  };
}

export function chooseOption(drill: Drill, mcq: Mcq, option: number): Drill {
  const answer = drill.answers[mcq.id] ?? { selected: [], checked: false };
  if (answer.checked) return drill;
  const selected = !mcq.multiSelect
    ? [option]
    : answer.selected.includes(option)
      ? answer.selected.filter((value) => value !== option)
      : [...answer.selected, option].sort((a, b) => a - b);
  return { ...drill, answers: { ...drill.answers, [mcq.id]: { ...answer, selected } } };
}

export function checkAnswer(drill: Drill, id: string): Drill {
  const answer = drill.answers[id];
  if (!answer || answer.selected.length === 0) return drill;
  return { ...drill, answers: { ...drill.answers, [id]: { ...answer, checked: true } } };
}

export function nextQuestion(drill: Drill): Drill {
  const last = drill.index >= drill.questionIds.length - 1;
  return last ? { ...drill, finished: true } : { ...drill, index: drill.index + 1 };
}

export function isCorrect(drill: Drill, mcq: Mcq): boolean {
  return scoreMcq(mcq, drill.answers[mcq.id]?.selected ?? [], 'all-or-nothing') === 1;
}

export function drillSummary(drill: Drill) {
  const questions = drill.questionIds.flatMap((id) => {
    const mcq = drillQuestion(id);
    return mcq ? [mcq] : [];
  });
  const missed = questions.filter((mcq) => !isCorrect(drill, mcq));
  return {
    total: questions.length,
    correct: questions.length - missed.length,
    missedIds: missed.map((mcq) => mcq.id),
  };
}

export function retryQuestions(ids: string[], random: () => number = Math.random): Drill {
  return { questionIds: shuffled(ids, random), index: 0, answers: {}, finished: false };
}

export function loadDrill(): Drill | null {
  try {
    const saved = JSON.parse(localStorage.getItem(DRILL_KEY) ?? 'null') as Drill | null;
    // A question may have left the bank since this was saved.
    return saved && saved.questionIds.every((id) => drillQuestion(id)) ? saved : null;
  } catch {
    return null;
  }
}

export function saveDrill(drill: Drill | null): void {
  try {
    if (drill) localStorage.setItem(DRILL_KEY, JSON.stringify(drill));
    else localStorage.removeItem(DRILL_KEY);
  } catch {
    // A drill is only practice, so carrying on without saving it is fine.
  }
}
