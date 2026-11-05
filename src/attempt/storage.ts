import { examFor } from '../content/bank.ts';
import { applyDeadline, type Attempt } from './attempt.ts';

const ATTEMPT_KEY = 'mockerrank.attempt';

export function loadAttempt(now: number): Attempt | null {
  try {
    const text = localStorage.getItem(ATTEMPT_KEY);
    if (!text) return null;
    const attempt = JSON.parse(text) as Attempt;
    // Discard an attempt saved by an older version, or for an exam that no longer exists.
    if (attempt.version !== 1 || !examFor(attempt)) return null;
    return applyDeadline(attempt, now);
  } catch {
    return null;
  }
}

// Returns false if the browser refused, such as when local storage is full.
export function saveAttempt(attempt: Attempt | null): boolean {
  try {
    if (attempt) localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt));
    else localStorage.removeItem(ATTEMPT_KEY);
    return true;
  } catch {
    return false;
  }
}
