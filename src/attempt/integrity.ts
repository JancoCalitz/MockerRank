import type { Attempt } from './attempt.ts';

export type IntegrityEventType =
  | 'focus-lost'
  | 'focus-returned'
  | 'tab-hidden'
  | 'tab-visible'
  | 'fullscreen-enter'
  | 'fullscreen-exit'
  | 'copy'
  | 'paste'
  | 'right-click'
  | 'resize';

export interface IntegrityEvent {
  type: IntegrityEventType;
  at: number;
  // The question open at the time, counting from 1.
  question: number;
}

export interface Integrity {
  counts: Partial<Record<IntegrityEventType, number>>;
  // Switching tabs fires both a focus and a visibility event, so this counts each time the
  // candidate left, not each event.
  departures: number;
  awayMs: number;
  awaySince: number | null;
  // The latest events. The counts above stay complete if this list is trimmed.
  events: IntegrityEvent[];
}

const MAX_STORED_EVENTS = 300;

export const EVENT_LABELS: Record<IntegrityEventType, string> = {
  'focus-lost': 'Window lost focus',
  'focus-returned': 'Window regained focus',
  'tab-hidden': 'Tab hidden',
  'tab-visible': 'Tab visible again',
  'fullscreen-enter': 'Entered full screen',
  'fullscreen-exit': 'Left full screen',
  copy: 'Copied from the editor',
  paste: 'Pasted into the editor',
  'right-click': 'Right-clicked',
  resize: 'Resized the window',
};

const EMPTY: Integrity = { counts: {}, departures: 0, awayMs: 0, awaySince: null, events: [] };

export function integrityOf(attempt: Attempt): Integrity {
  return attempt.integrity ?? EMPTY;
}

export function recordEvent(attempt: Attempt, type: IntegrityEventType, now: number): Attempt {
  if (attempt.status !== 'in_progress') return attempt;
  const current = integrityOf(attempt);
  const leaving = type === 'focus-lost' || type === 'tab-hidden';
  const returning = type === 'focus-returned' || type === 'tab-visible';
  const event: IntegrityEvent = { type, at: now, question: attempt.currentIndex + 1 };

  return {
    ...attempt,
    integrity: {
      counts: { ...current.counts, [type]: (current.counts[type] ?? 0) + 1 },
      departures: current.departures + (leaving && current.awaySince === null ? 1 : 0),
      awayMs:
        current.awayMs + (returning && current.awaySince !== null ? now - current.awaySince : 0),
      awaySince: leaving ? (current.awaySince ?? now) : returning ? null : current.awaySince,
      events: [...current.events, event].slice(-MAX_STORED_EVENTS),
    },
  };
}

// A change for the attempt, so components can record an event without reading the clock.
export function eventNow(type: IntegrityEventType): (attempt: Attempt) => Attempt {
  const now = Date.now();
  return (attempt) => recordEvent(attempt, type, now);
}

// What the warning banner counts. Copying, pasting, and resizing are normal while coding, so
// they are reported but do not trigger a warning.
export function violationCount(attempt: Attempt): number {
  const { departures, counts } = integrityOf(attempt);
  return departures + (counts['fullscreen-exit'] ?? 0);
}

export function integritySummary(attempt: Attempt) {
  const { departures, counts, awayMs, awaySince, events } = integrityOf(attempt);
  const end = attempt.finishedAt ?? attempt.deadline;
  return {
    departures,
    // Still away when the attempt ended, such as a tab left closed until the deadline.
    awayMs: awayMs + (awaySince === null ? 0 : Math.max(0, end - awaySince)),
    fullscreenExits: counts['fullscreen-exit'] ?? 0,
    copies: counts.copy ?? 0,
    pastes: counts.paste ?? 0,
    rightClicks: counts['right-click'] ?? 0,
    resizes: counts.resize ?? 0,
    events,
  };
}
