// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { optionOrder } from './option-order.ts';

const OPTIONS = ['a', 'b', 'c', 'd'];

describe('optionOrder', () => {
  it('uses every option exactly once', () => {
    expect([...optionOrder(OPTIONS, 'seed')].sort()).toEqual([0, 1, 2, 3]);
  });

  it('gives the same order for the same seed, so a reload changes nothing', () => {
    expect(optionOrder(OPTIONS, 'attempt-1/question')).toEqual(
      optionOrder(OPTIONS, 'attempt-1/question'),
    );
  });

  it('gives different orders across attempts', () => {
    const orders = new Set(
      Array.from({ length: 30 }, (_, attempt) => optionOrder(OPTIONS, `attempt-${attempt}`).join()),
    );
    expect(orders.size).toBeGreaterThan(5);
  });

  it('puts the first option in every position across attempts', () => {
    const positions = new Set(
      Array.from({ length: 60 }, (_, attempt) =>
        optionOrder(OPTIONS, `attempt-${attempt}`).indexOf(0),
      ),
    );
    expect(positions.size).toBe(4);
  });

  it('leaves options alone when one of them refers to the others', () => {
    const options = ['a', 'b', 'c', 'Both a and b'];
    expect(optionOrder(options, 'anything')).toEqual([0, 1, 2, 3]);
  });
});
