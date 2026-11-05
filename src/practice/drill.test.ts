import { beforeEach, describe, expect, it } from 'vitest';
import { clearHistory, historyEntry, loadHistory, recordInHistory } from '../attempt/history.ts';
import { exportProgress, importProgress } from '../attempt/backup.ts';
import { startAttempt } from '../attempt/attempt.ts';
import { EXAMS, MCQS } from '../content/bank.ts';
import {
  checkAnswer,
  chooseOption,
  drillQuestion,
  drillSummary,
  isCorrect,
  loadDrill,
  nextQuestion,
  retryQuestions,
  saveDrill,
  startDrill,
} from './drill.ts';

const single = MCQS.find((mcq) => !mcq.multiSelect)!;
const multi = MCQS.find((mcq) => mcq.multiSelect)!;

describe('startDrill', () => {
  it('only uses the chosen topics, up to the requested count', () => {
    const drill = startDrill(['git', 'sql'], 5);

    expect(drill.questionIds).toHaveLength(5);
    for (const id of drill.questionIds) {
      expect(['git', 'sql']).toContain(drillQuestion(id)!.topic);
    }
  });

  it('uses what exists when fewer questions are available than requested', () => {
    expect(startDrill(['git'], 1000).questionIds).toHaveLength(6);
    expect(startDrill([], 10).questionIds).toEqual([]);
  });

  it('does not repeat a question', () => {
    const { questionIds } = startDrill(['git', 'sql', 'testing'], 18);

    expect(new Set(questionIds).size).toBe(18);
  });
});

describe('answering', () => {
  it('replaces the choice on a single-select question, and toggles on multi-select', () => {
    let drill = startDrill([single.topic], 1);
    drill = chooseOption(drill, single, 0);
    drill = chooseOption(drill, single, 2);
    expect(drill.answers[single.id]!.selected).toEqual([2]);

    drill = chooseOption(drill, multi, 3);
    drill = chooseOption(drill, multi, 0);
    drill = chooseOption(drill, multi, 3);
    expect(drill.answers[multi.id]!.selected).toEqual([0]);
  });

  it('cannot check with nothing chosen, and cannot change after checking', () => {
    let drill = startDrill([single.topic], 1);
    expect(checkAnswer(drill, single.id)).toBe(drill);

    drill = checkAnswer(chooseOption(drill, single, 0), single.id);
    expect(drill.answers[single.id]!.checked).toBe(true);
    expect(chooseOption(drill, single, 1)).toBe(drill);
  });

  it('needs exactly the right choices on a multi-select question', () => {
    let drill = retryQuestions([multi.id]);
    for (const option of multi.correctIndexes.slice(0, -1)) {
      drill = chooseOption(drill, multi, option);
    }
    expect(isCorrect(drill, multi)).toBe(false);

    drill = chooseOption(drill, multi, multi.correctIndexes.at(-1)!);
    expect(isCorrect(drill, multi)).toBe(true);
  });
});

describe('finishing', () => {
  it('finishes after the last question, and summarises what was missed', () => {
    const first = single;
    const second = MCQS.find((mcq) => !mcq.multiSelect && mcq.id !== first.id)!;
    let drill = retryQuestions([first.id, second.id], () => 0.999);
    drill = chooseOption(drill, first, first.correctIndexes[0]!);
    drill = chooseOption(drill, second, (second.correctIndexes[0]! + 1) % 4);

    drill = nextQuestion(drill);
    expect(drill.finished).toBe(false);
    drill = nextQuestion(drill);
    expect(drill.finished).toBe(true);

    expect(drillSummary(drill)).toEqual({ total: 2, correct: 1, missedIds: [second.id] });
  });

  it('counts a question that was skipped as missed', () => {
    expect(drillSummary(retryQuestions([single.id])).missedIds).toEqual([single.id]);
  });
});

describe('saved drills', () => {
  beforeEach(() => localStorage.clear());

  it('round trips, and can be removed', () => {
    const drill = startDrill(['git'], 3);
    saveDrill(drill);
    expect(loadDrill()).toEqual(drill);

    saveDrill(null);
    expect(loadDrill()).toBeNull();
  });

  it('ignores damaged data, and a drill whose questions have left the bank', () => {
    localStorage.setItem('mockerrank.drill', 'not json');
    expect(loadDrill()).toBeNull();

    saveDrill(retryQuestions(['no-such-question']));
    expect(loadDrill()).toBeNull();
  });
});

describe('progress backups', () => {
  const exam = EXAMS[0]!;
  const score = { percent: 70, sections: [], topics: [], questions: [] };

  beforeEach(() => localStorage.clear());

  it('restores progress into an empty browser', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));
    const backup = exportProgress();
    clearHistory();

    expect(importProgress(backup)).toEqual({ ok: true, imported: 1 });
    expect(loadHistory()[0]!.percent).toBe(70);
  });

  it('adds to existing progress, and importing twice does not duplicate', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));
    const backup = exportProgress();
    recordInHistory(historyEntry({ ...startAttempt(exam, 9), finishedAt: 9 }, exam.name, score));

    importProgress(backup);
    importProgress(backup);

    expect(loadHistory()).toHaveLength(2);
  });

  it('rejects other files without changing anything', () => {
    recordInHistory(historyEntry({ ...startAttempt(exam, 5), finishedAt: 5 }, exam.name, score));

    expect(importProgress('not json')).toMatchObject({ ok: false });
    expect(importProgress('{"format":"other","entries":[]}')).toMatchObject({ ok: false });
    expect(
      importProgress(
        JSON.stringify({ format: 'mockerrank-progress', entries: [{ id: 'x', percent: 900 }] }),
      ),
    ).toMatchObject({ ok: false });
    expect(loadHistory()).toHaveLength(1);
  });
});
