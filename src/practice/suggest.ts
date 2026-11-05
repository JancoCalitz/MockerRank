import type { HistoryEntry } from '../attempt/history.ts';
import { combineTopics } from '../attempt/score.ts';
import type { CodingProblem } from '../content/schema.ts';

// Recent attempts show current ability better than an all-time average would.
const RECENT_ATTEMPTS = 5;
const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };

// Assisted attempts do not show what someone can do unaided.
export function weakestTopics(entries: HistoryEntry[], count: number): string[] {
  const fair = entries.filter((entry) => !entry.assisted);
  return combineTopics(fair.slice(-RECENT_ATTEMPTS).map((entry) => entry.topics))
    .filter((topic) => topic.percent < 100)
    .slice(0, count)
    .map((topic) => topic.topic);
}

// Problems missed in exams come first, then unsolved ones in weak topics, easiest first.
export function recommendProblems(
  problems: readonly CodingProblem[],
  {
    solved,
    missed,
    weakTopics,
  }: { solved: ReadonlySet<string>; missed: readonly string[]; weakTopics: readonly string[] },
  limit: number,
): CodingProblem[] {
  const open = problems.filter((problem) => !solved.has(problem.id));
  const fromExams = missed.flatMap((id) => open.filter((problem) => problem.id === id));
  const fromTopics = open
    .filter(
      (problem) =>
        !missed.includes(problem.id) && problem.topics.some((topic) => weakTopics.includes(topic)),
    )
    .sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
  return [...fromExams, ...fromTopics].slice(0, limit);
}
