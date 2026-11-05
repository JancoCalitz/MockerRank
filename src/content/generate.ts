import { MCQS, PROBLEMS } from './bank.ts';
import {
  examSchema,
  MCQ_COUNT,
  TOPICS,
  type CodingProblem,
  type Exam,
  type Mcq,
} from './schema.ts';

type Random = () => number;

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickProblem(
  type: CodingProblem['type'],
  seen: ReadonlySet<string>,
  random: Random,
): string {
  const options = shuffled(
    PROBLEMS.filter((problem) => problem.type === type),
    random,
  );
  const problem = options.find((option) => !seen.has(option.id)) ?? options[0];
  if (!problem) throw new Error(`The question bank has no ${type} problems.`);
  return problem.id;
}

function pickMcqs(seen: ReadonlySet<string>, random: Random): string[] {
  const remaining = new Map(
    TOPICS.map((topic) => [
      topic,
      shuffled(
        MCQS.filter((mcq) => mcq.topic === topic),
        random,
      ).sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id))),
    ]),
  );
  const unseenCount = (topic: (typeof TOPICS)[number]) =>
    remaining.get(topic)!.filter((mcq) => !seen.has(mcq.id)).length;
  const picked: Mcq[] = [];

  // Unseen questions come first. Among them, this takes the difficulty the exam has least of.
  const takeFrom = (topic: (typeof TOPICS)[number]) => {
    const options = remaining.get(topic)!;
    if (options.length === 0) return;
    const fresh = options.filter((mcq) => !seen.has(mcq.id));
    const pool = fresh.length > 0 ? fresh : options;
    const count = (mcq: Mcq) =>
      picked.filter((other) => other.difficulty === mcq.difficulty).length;
    const choice = pool.reduce((best, mcq) => (count(mcq) < count(best) ? mcq : best));
    options.splice(options.indexOf(choice), 1);
    picked.push(choice);
  };

  // Spreading the exam across every topic comes first.
  for (const topic of shuffled(TOPICS, random)) {
    if (picked.length < MCQ_COUNT) takeFrom(topic);
  }
  // Extra questions come from the topics with the most unseen questions left, so a later exam
  // can still cover every topic without repeats.
  while (picked.length < MCQ_COUNT && [...remaining.values()].some((list) => list.length > 0)) {
    const topic = shuffled(TOPICS, random)
      .filter((candidate) => remaining.get(candidate)!.length > 0)
      .reduce((best, candidate) => (unseenCount(candidate) > unseenCount(best) ? candidate : best));
    takeFrom(topic);
  }
  return picked.map((mcq) => mcq.id);
}

// Builds a random exam of 18 multiple choice questions, 1 short problem, and 1 long problem,
// balanced across topics and difficulty, avoiding questions already seen for as long as the bank
// has others. Questions only repeat once the bank runs out of unseen ones.
export function generateExam(
  seen: ReadonlySet<string>,
  now: number,
  random: Random = Math.random,
): Exam {
  return examSchema.parse({
    id: `random-${now}`,
    name: 'Random Exam',
    mcq: pickMcqs(seen, random),
    shortCoding: pickProblem('short', seen, random),
    longCoding: pickProblem('long', seen, random),
  });
}

export function examQuestionIds(exam: Exam): string[] {
  return [...exam.mcq, exam.shortCoding, exam.longCoding];
}
