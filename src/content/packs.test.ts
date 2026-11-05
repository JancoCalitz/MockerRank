import { beforeEach, describe, expect, it } from 'vitest';
import { EXAMS, MCQS, PROBLEMS } from './bank.ts';
import { exportPack, loadPacks, parsePack, savePacks, type KnownQuestions } from './packs.ts';

const known: KnownQuestions = { mcqs: MCQS, problems: PROBLEMS, exams: EXAMS };

const mcq = {
  id: 'pack-question',
  topic: 'git',
  difficulty: 'easy',
  stem: 'Question?',
  options: ['a', 'b', 'c', 'd'],
  correctIndexes: [0],
  explanation: 'Because.',
};

const problem = (overrides: object = {}) => ({
  id: 'pack-problem',
  title: 'Pack Problem',
  type: 'short',
  style: 'stdin',
  difficulty: 'easy',
  statement: 's',
  inputFormat: 'i',
  outputFormat: 'o',
  constraints: 'c',
  sampleTests: [{ input: '', output: '' }],
  hiddenTests: [{ input: '', output: '' }],
  languages: { python: { starter: 's', solution: 'x' } },
  checker: { type: 'exact' },
  editorial: 'e',
  ...overrides,
});

const pack = (overrides: object = {}) =>
  JSON.stringify({ format: 'mockerrank-pack', name: 'My pack', ...overrides });

const errorsOf = (text: string, against = known) => {
  const result = parsePack(text, against);
  return result.ok ? [] : result.errors;
};

describe('parsePack', () => {
  it('accepts a valid pack', () => {
    const result = parsePack(pack({ mcqs: [mcq], problems: [problem()] }), known);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pack.mcqs[0]!.id).toBe('pack-question');
      expect(result.pack.problems[0]!.id).toBe('pack-problem');
    }
  });

  it('accepts YAML as well as JSON', () => {
    const yaml = `format: mockerrank-pack
name: Yaml pack
mcqs:
  - id: yaml-question
    topic: git
    difficulty: easy
    stem: Question?
    options: [a, b, c, d]
    correctIndexes: [1]
    explanation: Because.
`;

    expect(parsePack(yaml, known).ok).toBe(true);
  });

  it('rejects unreadable files and wrong formats with clear errors', () => {
    expect(errorsOf('a: [unclosed').join()).toContain('not valid JSON or YAML');
    expect(errorsOf('{"format":"something-else","name":"x"}').join()).toContain('format');
    expect(errorsOf(pack({ mcqs: [{ ...mcq, options: ['a'] }] })).join()).toContain(
      'mcqs[0].options',
    );
  });

  it('rejects a file that is too large', () => {
    expect(errorsOf('x'.repeat(2_000_001)).join()).toContain('too large');
  });

  it('never accepts a custom checker, which would run code from the file in the page', () => {
    const custom = problem({ checker: { type: 'custom', script: 'return true;' } });

    expect(errorsOf(pack({ problems: [custom] })).join()).toContain('custom checker');
  });

  it('rejects a problem that refers to a test file', () => {
    const withFile = problem({ hiddenTests: [{ file: 'some-test' }] });

    expect(errorsOf(pack({ problems: [withFile] })).join()).toContain('test file');
  });

  it('skips items identical to existing ones, so importing twice is harmless', () => {
    const exported = exportPack('Everything', known);

    const result = parsePack(exported, known);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skipped).toBe(MCQS.length + PROBLEMS.length + EXAMS.length);
      expect(result.pack.mcqs).toEqual([]);
    }
  });

  it('rejects a different item that reuses an existing id', () => {
    const clash = { ...mcq, id: MCQS[0]!.id };

    expect(errorsOf(pack({ mcqs: [clash] })).join()).toContain('already used');
  });

  it('rejects an id used twice, or used by another type of item', () => {
    expect(errorsOf(pack({ mcqs: [mcq, mcq] })).join()).toContain('appears twice');
    expect(errorsOf(pack({ mcqs: [{ ...mcq, id: PROBLEMS[0]!.id }] })).join()).toContain(
      'another type',
    );
  });

  it('checks that an exam’s questions exist and are the right type', () => {
    const exam = {
      id: 'pack-exam',
      name: 'Pack Exam',
      mcq: ['missing', ...EXAMS[0]!.mcq.slice(1, 17), EXAMS[0]!.mcq[1]],
      shortCoding: EXAMS[0]!.longCoding,
      longCoding: 'nope',
    };

    const text = errorsOf(pack({ exams: [exam] })).join('\n');

    expect(text).toContain('unknown question "missing"');
    expect(text).toContain('lists a question twice');
    expect(text).toContain('needs a short problem');
    expect(text).toContain('unknown problem "nope"');
  });

  it('lets an exam mix questions from the pack and the bank', () => {
    const exam = {
      id: 'pack-exam',
      name: 'Pack Exam',
      mcq: [mcq.id, ...EXAMS[0]!.mcq.slice(1)],
      shortCoding: 'pack-problem',
      longCoding: EXAMS[0]!.longCoding,
    };

    expect(errorsOf(pack({ mcqs: [mcq], problems: [problem()], exams: [exam] }))).toEqual([]);
  });
});

describe('saved packs', () => {
  beforeEach(() => localStorage.clear());

  it('round trips', () => {
    const result = parsePack(pack({ mcqs: [mcq] }), known);
    if (!result.ok) throw new Error('expected a valid pack');

    savePacks([result.pack]);

    expect(loadPacks()).toEqual([result.pack]);
  });

  it('ignores damaged saved data, and damaged packs among good ones', () => {
    localStorage.setItem('mockerrank.packs', 'not json');
    expect(loadPacks()).toEqual([]);

    localStorage.setItem(
      'mockerrank.packs',
      JSON.stringify([{ nonsense: true }, JSON.parse(pack({ mcqs: [mcq] }))]),
    );
    expect(loadPacks()).toHaveLength(1);
  });
});
