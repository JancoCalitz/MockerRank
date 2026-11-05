// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { selectProblems } from './select-problems.ts';

const ALL = ['alpha', 'beta', 'gamma'];

describe('selectProblems', () => {
  it('checks everything by default', () => {
    expect(selectProblems(ALL, [], [])).toEqual(ALL);
  });

  it('checks only the named problems', () => {
    expect(selectProblems(ALL, ['gamma', 'alpha'], [])).toEqual(['alpha', 'gamma']);
  });

  it('rejects a name it does not know, rather than passing with nothing checked', () => {
    expect(() => selectProblems(ALL, ['alhpa'], [])).toThrow('alhpa');
  });

  it('finds changed problems from their YAML or test files', () => {
    const changed = ['content/coding/beta.yaml', 'content/tests/gamma-large.in', 'README.md'];

    expect(selectProblems(ALL, ['--changed'], changed)).toEqual(['beta', 'gamma']);
  });

  it('checks nothing when nothing changed', () => {
    expect(selectProblems(ALL, ['--changed'], ['content/mcq/bank-1.yaml'])).toEqual([]);
  });

  it('combines changed problems with named ones', () => {
    expect(selectProblems(ALL, ['--changed', 'alpha'], ['content/coding/beta.yaml'])).toEqual([
      'alpha',
      'beta',
    ]);
  });
});
