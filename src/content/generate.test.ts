import { describe, expect, it } from 'vitest';
import { EXAMS, examFor, examQuestions, MCQS, PROBLEMS } from './bank.ts';
import { examQuestionIds, generateExam } from './generate.ts';
import { LANGUAGE_IDS } from './languages.ts';
import { TOPICS } from './schema.ts';

// A small seeded generator, so a failure can be reproduced.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function topicsOf(mcqIds: string[]) {
  return mcqIds.map((id) => MCQS.find((mcq) => mcq.id === id)!.topic);
}

describe('generateExam', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`builds 5 full exams with no question repeated (seed ${seed})`, () => {
      const random = seeded(seed);
      const seen = new Set<string>();
      for (let round = 0; round < 5; round++) {
        const exam = generateExam(seen, round, random);
        expect(exam.mcq).toHaveLength(18);
        expect(new Set(exam.mcq).size).toBe(18);
        for (const id of examQuestionIds(exam)) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
        // Every exam covers every topic, even the last one, when the bank is nearly used up.
        expect(new Set(topicsOf(exam.mcq)).size).toBe(TOPICS.length);
      }
    });
  }

  it('picks the right type of coding problem', () => {
    const exam = generateExam(new Set(), 0, seeded(1));

    expect(PROBLEMS.find((problem) => problem.id === exam.shortCoding)!.type).toBe('short');
    expect(PROBLEMS.find((problem) => problem.id === exam.longCoding)!.type).toBe('long');
  });

  it('balances difficulty, rather than leaning on the easiest questions', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const exam = generateExam(new Set(), 0, seeded(seed));
      const count = (level: string) =>
        exam.mcq.filter((id) => MCQS.find((mcq) => mcq.id === id)!.difficulty === level).length;
      expect(count('easy')).toBeGreaterThanOrEqual(5);
      expect(count('medium')).toBeGreaterThanOrEqual(5);
    }
  });

  it('reuses questions only once the bank has run out of unseen ones', () => {
    const everything = new Set([...MCQS.map((mcq) => mcq.id), ...PROBLEMS.map((p) => p.id)]);

    const exam = generateExam(everything, 0, seeded(1));

    expect(exam.mcq).toHaveLength(18);
    expect(new Set(exam.mcq).size).toBe(18);
  });

  it('prefers unseen questions when only some have been seen', () => {
    const seen = new Set(EXAMS[0]!.mcq);

    const exam = generateExam(seen, 0, seeded(3));

    expect(exam.mcq.some((id) => seen.has(id))).toBe(false);
  });

  it('builds an exam the app can display', () => {
    const exam = generateExam(new Set(), 0, seeded(1));

    expect(examQuestions(exam)).toHaveLength(20);
    expect(exam.durationMinutes).toBe(90);
  });
});

describe('the question bank', () => {
  it('has 5 fixed mock exams with no question in more than one', () => {
    const ids = EXAMS.flatMap(examQuestionIds);

    expect(EXAMS).toHaveLength(5);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(100);
  });

  it('uses every question in the first batch', () => {
    expect(EXAMS.flatMap((exam) => exam.mcq).sort()).toEqual(MCQS.map((mcq) => mcq.id).sort());
  });

  it('covers every topic in every fixed exam', () => {
    for (const exam of EXAMS) {
      expect(new Set(topicsOf(exam.mcq)).size).toBe(TOPICS.length);
    }
  });

  it('offers every required language, with a reference solution, in every coding problem', () => {
    for (const problem of PROBLEMS) {
      for (const language of LANGUAGE_IDS) {
        expect(problem.languages[language]?.solution, `${problem.id} ${language}`).toBeTruthy();
      }
    }
  });

  it('has the first batch’s share of each type', () => {
    expect(MCQS).toHaveLength(90);
    expect(PROBLEMS.filter((problem) => problem.type === 'short')).toHaveLength(5);
    expect(PROBLEMS.filter((problem) => problem.type === 'long')).toHaveLength(5);
  });
});

describe('examFor', () => {
  it('finds a fixed exam by id, and uses the copy stored with a random one', () => {
    const generated = generateExam(new Set(), 7, seeded(1));

    expect(examFor({ examId: EXAMS[0]!.id })).toBe(EXAMS[0]);
    expect(examFor({ examId: generated.id, generatedExam: generated })).toBe(generated);
    expect(examFor({ examId: 'gone' })).toBeUndefined();
  });

  it('skips a question that has since left the bank, rather than failing', () => {
    const exam = { ...EXAMS[0]!, mcq: ['no-such-question', ...EXAMS[0]!.mcq.slice(1)] };

    expect(examQuestions(exam)).toHaveLength(19);
  });
});
