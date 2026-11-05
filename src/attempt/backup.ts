import { z } from 'zod';
import { TOPICS } from '../content/schema.ts';
import { loadHistory, recordInHistory, type HistoryEntry } from './history.ts';

// The progress page reads these fields directly. The saved attempt is only read when reopening
// it, and the app's error screen covers a damaged one.
const entrySchema = z.looseObject({
  id: z.string().min(1),
  examId: z.string(),
  examName: z.string(),
  status: z.enum(['submitted', 'expired', 'in_progress']),
  finishedAt: z.number(),
  assisted: z.boolean(),
  percent: z.number().min(0).max(100),
  topics: z.array(
    z.looseObject({
      topic: z.enum(TOPICS),
      percent: z.number().min(0).max(100),
      questions: z.number().positive(),
    }),
  ),
});

const backupSchema = z.object({
  format: z.literal('mockerrank-progress'),
  entries: z.array(entrySchema),
});

export function exportProgress(): string {
  return JSON.stringify({ format: 'mockerrank-progress', entries: loadHistory() });
}

export type ImportResult = { ok: true; imported: number } | { ok: false; error: string };

// Adds to what is already here. An attempt already recorded is replaced by the imported copy.
export function importProgress(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const parsed = backupSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: 'This is not a MockerRank progress backup.' };
  for (const entry of parsed.data.entries) {
    if (!recordInHistory(entry as unknown as HistoryEntry)) {
      return { ok: false, error: 'Your browser could not save this, as its storage may be full.' };
    }
  }
  return { ok: true, imported: parsed.data.entries.length };
}
