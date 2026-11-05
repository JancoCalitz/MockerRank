// Answers keep their original indexes for scoring, and only the order on screen changes. That order
// comes from a seed, so it stays put when the page reloads or the attempt is reviewed later, while a
// new attempt gets a new one. Otherwise, people could remember an answer by its position.
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32;
  };
}

// An option like "Both of the above" only makes sense where its author put it.
const REFERS_TO_OTHERS = /\b(above|below|both|neither|none of)\b/i;

export function optionOrder(options: readonly string[], seed: string): number[] {
  const order = options.map((_, index) => index);
  if (options.some((option) => REFERS_TO_OTHERS.test(option))) return order;
  const random = seededRandom(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}
