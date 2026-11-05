// CheerpJ runs Java on the page's main thread, and nothing can interrupt a tight loop
// there, so an endless loop would freeze the tab for good. To prevent that, this adds a
// call to a guard inside each loop. The guard enforces the limits and lets the page breathe.
// All insertions stay on the original line, so line numbers still match the candidate's code.

const TICK = 'mockerrank.G.t();';
const TICK_CONDITION = 'mockerrank.G.b()';

// Returns the index just past a comment or literal starting at i, or i if there is none.
function skipNonCode(source: string, i: number): number {
  const two = source.slice(i, i + 2);
  if (two === '//') {
    const end = source.indexOf('\n', i);
    return end < 0 ? source.length : end;
  }
  if (two === '/*') {
    const end = source.indexOf('*/', i + 2);
    return end < 0 ? source.length : end + 2;
  }
  if (source.startsWith('"""', i)) {
    const end = source.indexOf('"""', i + 3);
    return end < 0 ? source.length : end + 3;
  }
  const quote = source[i];
  if (quote === '"' || quote === "'") {
    let j = i + 1;
    while (j < source.length && source[j] !== quote && source[j] !== '\n') {
      j += source[j] === '\\' ? 2 : 1;
    }
    return j + 1;
  }
  return i;
}

function skipSpace(source: string, start: number): number {
  let i = start;
  while (i < source.length) {
    if (/\s/.test(source[i]!)) {
      i++;
      continue;
    }
    const next = skipNonCode(source, i);
    if (next === i || !['/'].includes(source[i]!)) return i;
    i = next;
  }
  return i;
}

// Finds the parenthesis matching the one at start, and any top-level semicolons within.
function matchParens(source: string, start: number): { close: number; semicolons: number[] } {
  let depth = 0;
  const semicolons: number[] = [];
  let i = start;
  while (i < source.length) {
    const next = skipNonCode(source, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const c = source[i];
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { close: i, semicolons };
    else if (c === ';' && depth === 1) semicolons.push(i);
    i++;
  }
  return { close: -1, semicolons };
}

export function instrumentJava(source: string): string {
  const inserts: { at: number; text: string; end?: number }[] = [];
  const openDoLoops: number[] = [];
  let braceDepth = 0;
  let i = 0;

  while (i < source.length) {
    const next = skipNonCode(source, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const c = source[i]!;
    if (c === '{') braceDepth++;
    if (c === '}') braceDepth--;

    const word = /^[A-Za-z_$][\w$]*/.exec(source.slice(i, i + 64))?.[0];
    if (!word) {
      i += /[\w$]/.test(c) ? 1 : 1;
      // Skip the rest of a token such as 1e5, so it cannot look like a keyword.
      while (/[\w$]/.test(c) && /[\w$]/.test(source[i] ?? '')) i++;
      continue;
    }
    const wordEnd = i + word.length;

    if (word === 'do') {
      const body = skipSpace(source, wordEnd);
      if (source[body] === '{') inserts.push({ at: body + 1, text: TICK });
      openDoLoops.push(braceDepth);
    } else if (word === 'while' || word === 'for') {
      const open = skipSpace(source, wordEnd);
      if (source[open] === '(') {
        const { close, semicolons } = matchParens(source, open);
        if (close >= 0) {
          const isDoTail = word === 'while' && openDoLoops.at(-1) === braceDepth;
          if (isDoTail) {
            openDoLoops.pop();
            // A do body with no braces has nowhere else to put the guard.
            inserts.push({ at: open + 1, text: `${TICK_CONDITION} && (` });
            inserts.push({ at: close, text: ')' });
          } else if (word === 'for' && semicolons.length === 0) {
            // for (x : list) always ends, unless its body has its own loop.
            const body = skipSpace(source, close + 1);
            if (source[body] === '{') inserts.push({ at: body + 1, text: TICK });
          } else {
            const body = skipSpace(source, close + 1);
            if (source[body] === '{') {
              inserts.push({ at: body + 1, text: TICK });
            } else if (source[body] === ';') {
              // An empty loop body, such as while (!done);
              inserts.push({ at: body, text: `{${TICK}}`, end: body + 1 });
            } else if (word === 'while') {
              inserts.push({ at: open + 1, text: `${TICK_CONDITION} && (` });
              inserts.push({ at: close, text: ')' });
            } else {
              const [first, second] = semicolons as [number, number];
              const empty = source.slice(first + 1, second).trim() === '';
              inserts.push({
                at: first + 1,
                text: empty ? TICK_CONDITION : `${TICK_CONDITION} && (`,
              });
              if (!empty) inserts.push({ at: second, text: ')' });
            }
          }
        }
      }
    }
    i = wordEnd;
  }

  let result = '';
  let last = 0;
  for (const { at, text, end } of inserts.sort((a, b) => a.at - b.at)) {
    result += source.slice(last, at) + text;
    last = end ?? at;
  }
  return result + source.slice(last);
}

// Finds the class whose main method to run, and so the file name javac requires.
export function findMainClass(source: string): string {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ' ');
  const packageName = /^\s*package\s+([\w.]+)\s*;/m.exec(code)?.[1];
  const main = code.search(/static\s+void\s+main\b|void\s+static\s+main\b/);
  const classes = [...code.matchAll(/\b(?:class|record|enum|interface)\s+([A-Za-z_$][\w$]*)/g)];
  const before = classes.filter((match) => main < 0 || match.index < main);
  const name = before.at(-1)?.[1] ?? classes[0]?.[1] ?? 'Main';
  return packageName ? `${packageName}.${name}` : name;
}

export function publicClassName(source: string): string | null {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ' ');
  return /\bpublic\s+(?:final\s+|abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(code)?.[1] ?? null;
}
