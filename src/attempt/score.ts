import { examQuestions, type Question } from '../content/bank.ts';
import type { CodingProblem, Exam, Mcq } from '../content/schema.ts';
import { TOPICS } from '../content/schema.ts';
import { codingAnswer, type Attempt, type StoredJudgeResult } from './attempt.ts';

export const READINESS_TARGET = 80;

export const TOPIC_LABELS: Record<(typeof TOPICS)[number], string> = {
  'arrays-strings': 'Arrays and strings',
  hashing: 'Hashing',
  'sorting-searching': 'Sorting and searching',
  'stacks-queues': 'Stacks and queues',
  'linked-lists': 'Linked lists',
  'trees-graphs': 'Trees and graphs',
  'recursion-dp': 'Recursion and dynamic programming',
  'big-o': 'Big-O reasoning',
  'oop-design': 'OOP and design',
  sql: 'SQL',
  'debugging-code-reading': 'Debugging and code reading',
  'language-trivia': 'Language details',
  'rest-http': 'REST and HTTP',
  git: 'Git',
  testing: 'Testing',
};

type Topic = (typeof TOPICS)[number];
export type SectionId = 'mcq' | 'short' | 'long';

export interface SectionScore {
  id: SectionId;
  label: string;
  // This section's share of the total, from 0 to 100.
  weightPercent: number;
  percent: number;
}

export interface TopicScore {
  topic: Topic;
  percent: number;
  questions: number;
}

export interface QuestionScore {
  question: Question;
  // From 0 to 1.
  earned: number;
  timeMs: number;
}

export interface AttemptScore {
  percent: number;
  sections: SectionScore[];
  topics: TopicScore[];
  questions: QuestionScore[];
}

export function scoreMcq(
  mcq: Mcq,
  selected: number[],
  rule: Exam['scoring']['multiSelect'],
): number {
  if (selected.length === 0) return 0;
  const correct = new Set(mcq.correctIndexes);
  const hits = selected.filter((option) => correct.has(option)).length;
  const wrong = selected.length - hits;
  if (mcq.multiSelect && rule === 'partial') return Math.max(0, (hits - wrong) / correct.size);
  return wrong === 0 && hits === correct.size ? 1 : 0;
}

// A submission runs the sample tests and then the hidden ones, in that order.
export function scoreCoding(problem: CodingProblem, result: StoredJudgeResult | undefined): number {
  if (!result?.compiled) return 0;
  const weights = [
    ...problem.sampleTests.map(() => 1),
    ...problem.hiddenTests.map((test) => test.weight),
  ];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const earned = weights.reduce(
    (sum, weight, index) => sum + (result.tests[index]?.verdict === 'accepted' ? weight : 0),
    0,
  );
  return earned / total;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreAttempt(attempt: Attempt, exam: Exam): AttemptScore {
  const { scoring } = exam;
  const questions: QuestionScore[] = examQuestions(exam).map((question) => ({
    question,
    timeMs: attempt.timeSpentMs[question.id] ?? 0,
    earned:
      question.kind === 'mcq'
        ? scoreMcq(question.mcq, attempt.mcq[question.id]?.selected ?? [], scoring.multiSelect)
        : scoreCoding(question.problem, codingAnswer(attempt, question.problem).submission),
  }));

  const isSection = (id: SectionId) => (score: QuestionScore) => {
    if (score.question.kind === 'mcq') return id === 'mcq';
    return score.question.problem.type === id;
  };
  const totalWeight = scoring.mcqWeight + scoring.shortWeight + scoring.longWeight;
  const sections = (
    [
      ['mcq', 'Multiple choice', scoring.mcqWeight],
      ['short', 'Short coding', scoring.shortWeight],
      ['long', 'Long coding', scoring.longWeight],
    ] as const
  ).map(([id, label, weight]): SectionScore => ({
    id,
    label,
    weightPercent: (weight / totalWeight) * 100,
    percent: average(questions.filter(isSection(id)).map((score) => score.earned)) * 100,
  }));
  const percent = sections.reduce(
    (sum, section) => sum + (section.percent * section.weightPercent) / 100,
    0,
  );

  const byTopic = new Map<Topic, number[]>();
  for (const { question, earned } of questions) {
    const topics = question.kind === 'mcq' ? [question.mcq.topic] : question.problem.topics;
    for (const topic of topics) byTopic.set(topic, [...(byTopic.get(topic) ?? []), earned]);
  }
  const topics = [...byTopic].map(([topic, earned]): TopicScore => ({
    topic,
    percent: average(earned) * 100,
    questions: earned.length,
  }));

  return { percent, sections, topics: topics.sort((a, b) => a.percent - b.percent), questions };
}

// Combines topic results across attempts, weighting each topic by its number of questions.
export function combineTopics(lists: TopicScore[][]): TopicScore[] {
  const totals = new Map<Topic, { earned: number; questions: number }>();
  for (const { topic, percent, questions } of lists.flat()) {
    const total = totals.get(topic) ?? { earned: 0, questions: 0 };
    totals.set(topic, {
      earned: total.earned + (percent / 100) * questions,
      questions: total.questions + questions,
    });
  }
  return [...totals]
    .map(([topic, { earned, questions }]) => ({
      topic,
      questions,
      percent: (earned / questions) * 100,
    }))
    .sort((a, b) => a.percent - b.percent);
}
