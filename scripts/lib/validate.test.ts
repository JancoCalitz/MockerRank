// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { validateContent } from './validate.ts';

const SOLUTION = `const n = Number(require('fs').readFileSync(0, 'utf8')); console.log(n * 2);`;

const mcq = (id: string, overrides: object = {}) => ({
  id,
  topic: 'hashing',
  difficulty: 'easy',
  stem: 'Question?',
  options: ['A', 'B', 'C', 'D'],
  correctIndexes: [0],
  explanation: 'Because.',
  ...overrides,
});

const problem = (id: string, overrides: object = {}) => ({
  id,
  title: 'Double',
  type: 'short',
  style: 'stdin',
  difficulty: 'easy',
  statement: 'Double it.',
  inputFormat: 'A number.',
  outputFormat: 'A number.',
  constraints: 'Small.',
  sampleTests: [{ input: '2\n', output: '4\n' }],
  hiddenTests: [{ input: '3\n', output: '6\n' }],
  languages: { javascript: { starter: '// code', solution: SOLUTION } },
  checker: { type: 'exact' },
  editorial: 'Multiply.',
  ...overrides,
});

const exam = (overrides: object = {}) => ({
  id: 'mock',
  name: 'Mock',
  mcq: Array.from({ length: 18 }, (_, i) => `q${i}`),
  shortCoding: 'short-one',
  longCoding: 'long-one',
  ...overrides,
});

const validBank = () => ({
  'mcq/bank.yaml': Array.from({ length: 18 }, (_, i) => mcq(`q${i}`)),
  'coding/short-one.yaml': problem('short-one'),
  'coding/long-one.yaml': problem('long-one', { type: 'long' }),
  'exams/mock.yaml': exam(),
});

describe('validateContent', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function validate(files: Record<string, unknown>) {
    const dir = mkdtempSync(join(tmpdir(), 'mockerrank-test-'));
    dirs.push(dir);
    for (const [path, value] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      const text = typeof value === 'string' ? value : stringify(value);
      writeFileSync(join(dir, path), text);
    }
    return validateContent(dir);
  }

  it('accepts a complete, correct bank', () => {
    const report = validate(validBank());

    expect(report.errors).toEqual([]);
    expect(report.counts).toEqual({ mcq: 18, coding: 2, exams: 1, referenceRuns: 4 });
  });

  it('fails when the content folder does not exist', () => {
    const report = validateContent(join(tmpdir(), 'mockerrank-no-such-folder'));

    expect(report.errors.join()).toContain('content folder not found');
  });

  it('names the file and field of a schema error', () => {
    const report = validate({ 'mcq/bad.yaml': [mcq('one', { options: ['A', 'B'] })] });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('bad.yaml: [0].options must have exactly 4 options');
  });

  it('still checks the other questions in a file when one is invalid', () => {
    const report = validate({
      'mcq/mixed.yaml': [mcq('bad', { stem: '' }), mcq('same'), mcq('same')],
      'exams/one.yaml': exam({ mcq: ['same', ...Array.from({ length: 17 }, () => 'bad')] }),
    });

    const text = report.errors.join('\n');
    expect(text).toContain('[0].stem must not be empty');
    expect(text).toContain('duplicate id "same"');
    expect(text).not.toContain('unknown question "same"');
  });

  it('rejects an MCQ file that is not a list', () => {
    const report = validate({ 'mcq/bad.yaml': mcq('one') });

    expect(report.errors.join()).toContain('must be a list of questions');
  });

  it('rejects unknown fields, so typos are caught', () => {
    const report = validate({ 'mcq/bad.yaml': [mcq('one', { explaination: 'typo' })] });

    expect(report.errors.join()).toContain('explaination');
  });

  it('rejects several correct answers on a single-select question', () => {
    const report = validate({ 'mcq/bad.yaml': [mcq('one', { correctIndexes: [0, 1] })] });

    expect(report.errors.join()).toContain('exactly one option');
  });

  it('accepts several correct answers on a multi-select question', () => {
    const report = validate({
      'mcq/ok.yaml': [mcq('one', { correctIndexes: [0, 1], multiSelect: true })],
    });

    expect(report.errors).toEqual([]);
  });

  it('reports invalid YAML', () => {
    const report = validate({ 'mcq/bad.yaml': 'a: [unclosed' });

    expect(report.errors.join()).toContain('bad.yaml: invalid YAML');
  });

  it('rejects duplicate ids across files and content types', () => {
    const report = validate({
      'mcq/a.yaml': [mcq('same')],
      'mcq/b.yaml': [mcq('same')],
      'coding/c.yaml': problem('same'),
    });

    const duplicates = report.errors.filter((error) => error.includes('duplicate id "same"'));
    expect(duplicates).toHaveLength(2);
  });

  it('rejects a reference solution that gives a wrong answer', () => {
    const report = validate({
      'coding/bad.yaml': problem('bad', { hiddenTests: [{ input: '3\n', output: '7\n' }] }),
    });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain('JavaScript reference solution failed hidden test 1');
    expect(report.errors[0]).toContain('expected: 7');
    expect(report.errors[0]).toContain('actual:   6');
  });

  it('rejects a reference solution that crashes', () => {
    const languages = { javascript: { starter: 's', solution: 'throw new Error("boom");' } };
    const report = validate({ 'coding/bad.yaml': problem('bad', { languages }) });

    expect(report.errors[0]).toContain('failed sample test 1: exited with 1');
    expect(report.errors[0]).toContain('boom');
  });

  it('rejects a reference solution that exceeds the time limit', () => {
    const languages = { javascript: { starter: 's', solution: 'while (true) {}' } };
    const report = validate({
      'coding/bad.yaml': problem('bad', { languages, timeLimitMs: 300 }),
    });

    expect(report.errors[0]).toContain('exceeded the 300 ms time limit');
  });

  it('runs function-style solutions inside their harness', () => {
    const harness = `{{USER_CODE}}\nconsole.log(twice(Number(require('fs').readFileSync(0, 'utf8'))));`;
    const report = validate({
      'coding/fn.yaml': problem('fn', {
        style: 'function',
        languages: {
          javascript: { starter: 's', harness, solution: 'const twice = (n) => n * 2;' },
        },
      }),
    });

    expect(report.errors).toEqual([]);
    expect(report.counts.referenceRuns).toBe(2);
  });

  it('rejects a function-style harness without the code marker', () => {
    const report = validate({
      'coding/fn.yaml': problem('fn', {
        style: 'function',
        languages: { javascript: { starter: 's', harness: 'no marker', solution: 'x' } },
      }),
    });

    expect(report.errors.join()).toContain('languages.javascript.harness must contain');
  });

  it('reports solutions it cannot run, and fails if none can run', () => {
    const report = validate({
      'coding/java.yaml': problem('java', {
        languages: { java: { starter: 's', solution: 'class Main {}' } },
      }),
    });

    expect(report.skipped.join()).toContain('Java 17 reference solution');
    expect(report.errors.join()).toContain('no reference solution could be run');
  });

  it('reports bad exam references', () => {
    const files = {
      ...validBank(),
      'exams/mock.yaml': exam({
        mcq: ['missing', ...Array.from({ length: 16 }, (_, i) => `q${i}`), 'q0'],
        shortCoding: 'long-one',
        longCoding: 'nope',
      }),
    };

    const text = validate(files).errors.join('\n');
    expect(text).toContain('unknown question "missing"');
    expect(text).toContain('must not list a question twice');
    expect(text).toContain('shortCoding names "long-one", which is a long problem');
    expect(text).toContain('longCoding names unknown problem "nope"');
  });

  it('requires exactly 18 questions in an exam', () => {
    const report = validate({ 'exams/mock.yaml': exam({ mcq: ['q0'] }) });

    expect(report.errors.join()).toContain('must list exactly 18 questions');
  });
});
