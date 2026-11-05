import { describe, expect, it } from 'vitest';
import { EXAMS } from '../content/bank.ts';
import { finishAttempt, goToQuestion, startAttempt, type Attempt } from './attempt.ts';
import {
  integrityOf,
  integritySummary,
  recordEvent,
  violationCount,
  type IntegrityEventType,
} from './integrity.ts';

const exam = EXAMS[0]!;
const fresh = () => startAttempt(exam, 0);

function play(events: [IntegrityEventType, number][], attempt: Attempt = fresh()) {
  return events.reduce((current, [type, at]) => recordEvent(current, type, at), attempt);
}

describe('recordEvent', () => {
  it('counts a tab switch once, although the browser fires two events each way', () => {
    const attempt = play([
      ['focus-lost', 100],
      ['tab-hidden', 101],
      ['tab-visible', 500],
      ['focus-returned', 501],
    ]);

    const summary = integritySummary(attempt);
    expect(summary.departures).toBe(1);
    expect(summary.awayMs).toBe(400);
    expect(summary.events).toHaveLength(4);
  });

  it('counts the events in the other order the same way', () => {
    const attempt = play([
      ['tab-hidden', 100],
      ['focus-lost', 101],
      ['focus-returned', 300],
      ['tab-visible', 301],
    ]);

    expect(integritySummary(attempt).departures).toBe(1);
    expect(integritySummary(attempt).awayMs).toBe(200);
  });

  it('counts each separate time away, and adds the time up', () => {
    const attempt = play([
      ['focus-lost', 100],
      ['focus-returned', 200],
      ['focus-lost', 1000],
      ['focus-returned', 1500],
    ]);

    expect(integritySummary(attempt).departures).toBe(2);
    expect(integritySummary(attempt).awayMs).toBe(600);
  });

  it('includes time away when the attempt ends before the candidate returns', () => {
    const away = play([['focus-lost', 100]]);

    const finished = finishAttempt(away, 'expired', 1100);

    expect(integritySummary(finished).awayMs).toBe(1000);
  });

  it('ignores a return without a departure', () => {
    const summary = integritySummary(play([['focus-returned', 100]]));

    expect(summary.departures).toBe(0);
    expect(summary.awayMs).toBe(0);
  });

  it('records which question was open', () => {
    const attempt = recordEvent(goToQuestion(fresh(), 4), 'paste', 100);

    expect(integrityOf(attempt).events[0]).toEqual({ type: 'paste', at: 100, question: 5 });
  });

  it('stops recording once the attempt has finished', () => {
    const finished = finishAttempt(fresh(), 'submitted', 100);

    expect(recordEvent(finished, 'paste', 200)).toBe(finished);
  });

  it('keeps counts complete when the event list is trimmed', () => {
    const many = Array.from({ length: 350 }, (_, i): [IntegrityEventType, number] => ['resize', i]);

    const { events, resizes } = integritySummary(play(many));

    expect(events).toHaveLength(300);
    expect(events.at(-1)!.at).toBe(349);
    expect(resizes).toBe(350);
  });

  it('reads attempts saved before tracking existed', () => {
    const older = { ...fresh() };
    delete older.integrity;

    expect(integritySummary(older).departures).toBe(0);
    expect(violationCount(older)).toBe(0);
    expect(integritySummary(recordEvent(older, 'copy', 1)).copies).toBe(1);
  });
});

describe('violationCount', () => {
  it('counts leaving and full screen exits, but not normal coding actions', () => {
    const attempt = play([
      ['copy', 1],
      ['paste', 2],
      ['right-click', 3],
      ['resize', 4],
    ]);
    expect(violationCount(attempt)).toBe(0);

    const worse = play(
      [
        ['tab-hidden', 5],
        ['focus-lost', 6],
        ['focus-returned', 7],
        ['fullscreen-exit', 8],
      ],
      attempt,
    );
    expect(violationCount(worse)).toBe(2);
  });
});
