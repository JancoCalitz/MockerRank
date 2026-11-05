import { describe, expect, it } from 'vitest';
import { findMainClass, instrumentJava, publicClassName } from './java-instrument.ts';

const T = 'mockerrank.G.t();';
const B = 'mockerrank.G.b()';

describe('instrumentJava', () => {
  it('guards braced while and for loops inside the body, so constant conditions still compile', () => {
    expect(instrumentJava('while (true) { x(); }')).toBe(`while (true) {${T} x(); }`);
    expect(instrumentJava('for (;;) { x(); }')).toBe(`for (;;) {${T} x(); }`);
    expect(instrumentJava('for (int i = 0; i < n; i++) { x(); }')).toBe(
      `for (int i = 0; i < n; i++) {${T} x(); }`,
    );
  });

  it('guards enhanced for loops only when they have a body block', () => {
    expect(instrumentJava('for (int v : list) { x(v); }')).toBe(`for (int v : list) {${T} x(v); }`);
    expect(instrumentJava('for (int v : list) x(v);')).toBe('for (int v : list) x(v);');
  });

  it('guards loops without braces through the condition', () => {
    expect(instrumentJava('while (a) x();')).toBe(`while (${B} && (a)) x();`);
    expect(instrumentJava('for (i = 0; i < n; i++) x();')).toBe(
      `for (i = 0;${B} && ( i < n); i++) x();`,
    );
    expect(instrumentJava('for (;;) x();')).toBe(`for (;${B};) x();`);
  });

  it('gives an empty loop body a guard', () => {
    expect(instrumentJava('while (!done);')).toBe(`while (!done){${T}}`);
  });

  it('treats the while ending a do loop as a condition, not a new loop', () => {
    expect(instrumentJava('do { x(); } while (a);')).toBe(`do {${T} x(); } while (${B} && (a));`);
    expect(instrumentJava('do x(); while (a);')).toBe(`do x(); while (${B} && (a));`);
  });

  it('handles nested loops', () => {
    expect(instrumentJava('while (a) { do { b(); } while (c); }')).toBe(
      `while (a) {${T} do {${T} b(); } while (${B} && (c)); }`,
    );
  });

  it('ignores keywords in strings, comments, characters, and longer names', () => {
    const source = [
      'String s = "while (true) {";',
      '// for (;;) {',
      '/* do { */',
      "char c = '{';",
      'String t = """',
      'while (x) {',
      '""";',
      'int format = doThing(forEach, whileLoop);',
    ].join('\n');
    expect(instrumentJava(source)).toBe(source);
  });

  it('handles parentheses, semicolons, and comments in tricky places', () => {
    expect(instrumentJava('while (f(a, ")") ) /* why */ { x(); }')).toBe(
      `while (f(a, ")") ) /* why */ {${T} x(); }`,
    );
    expect(instrumentJava('for (;;) // forever\n{ x(); }')).toBe(
      `for (;;) // forever\n{${T} x(); }`,
    );
  });

  it('keeps line numbers the same', () => {
    const source = 'class A {\n  void f() {\n    while (true)\n    {\n      g();\n    }\n  }\n}\n';
    expect(instrumentJava(source).split('\n')).toHaveLength(source.split('\n').length);
  });
});

describe('findMainClass', () => {
  it('finds the class containing main', () => {
    expect(findMainClass('class A {}\nclass B { public static void main(String[] a) {} }')).toBe(
      'B',
    );
    expect(
      findMainClass('public class Solution { static void main(String[] a) {} } class C {}'),
    ).toBe('Solution');
  });

  it('includes the package', () => {
    expect(findMainClass('package a.b;\nclass M { static void main(String[] x) {} }')).toBe(
      'a.b.M',
    );
  });

  it('ignores comments', () => {
    expect(findMainClass('// class Fake\nclass Real { static void main(String[] a) {} }')).toBe(
      'Real',
    );
  });
});

describe('publicClassName', () => {
  it('names the public class, which sets the file name', () => {
    expect(publicClassName('class A {} public class B {}')).toBe('B');
    expect(publicClassName('class A {}')).toBeNull();
  });
});
