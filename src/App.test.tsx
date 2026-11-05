import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { EXAMS, examQuestions } from './content/bank.ts';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('Worker', class {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the exam and its rules before starting', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: EXAMS[0]!.name })).toBeTruthy();
    expect(screen.getByText(/90 minutes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start test' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns when the browser lacks a required feature', () => {
    vi.stubGlobal('Worker', undefined);

    render(<App />);

    expect(screen.getByRole('alert').textContent).toContain('Web Workers');
  });

  it('starts a timed attempt, and resumes it after a reload', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));

    expect(screen.getByRole('timer').textContent).toMatch(/1:30:00|1:29:5\d/);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    unmount();

    render(<App />);

    expect(screen.getByRole('timer')).toBeTruthy();
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Question 1, answered' })).toBeTruthy();
  });

  it('asks for confirmation before the final submit, showing what is left', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Flag for review' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('20 unanswered');
    expect(dialog.textContent).toContain('1 flagged');

    fireEvent.click(screen.getByRole('button', { name: 'Keep working' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('timer')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit final answers' }));
    expect(screen.getByRole('heading', { name: 'Test submitted' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Total score' }).nextElementSibling!.textContent,
    ).toBe('0%');
    expect(screen.getByText('80 points below the 80% target.')).toBeTruthy();
  });

  it('shows an expired attempt as finished when reopened after the deadline', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));
    unmount();
    const saved = JSON.parse(localStorage.getItem('mockerrank.attempt')!);
    localStorage.setItem(
      'mockerrank.attempt',
      JSON.stringify({ ...saved, deadline: Date.now() - 1000 }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Time is up' })).toBeTruthy();
  });

  it('scores a correct answer, shows its explanation, and keeps it in progress', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start test' }));
    const correct = examQuestions(EXAMS[0]!)[0]!;
    if (correct.kind !== 'mcq') throw new Error('expected a multiple choice question');
    const answer = correct.mcq.options[correct.mcq.correctIndexes[0]!]!;
    fireEvent.click(screen.getByRole('radio', { name: answer }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit test' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit final answers' }));

    // One of 18 multiple choice questions, which are worth 40% of the total.
    expect(
      screen.getByRole('heading', { name: 'Total score' }).nextElementSibling!.textContent,
    ).toBe('2%');
    // One correct answer per question, except the multi-select question, which has three.
    expect(screen.getAllByText(/✓ Correct answer/).length).toBe(20);
    expect(screen.getAllByText(/Your answer/).length).toBe(1);
    expect(screen.getAllByText('Explanation').length).toBe(18);

    fireEvent.click(screen.getByRole('button', { name: 'View progress' }));
    expect(screen.getByRole('heading', { name: 'Your progress' })).toBeTruthy();
    expect(screen.getByRole('meter')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review attempt 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Review attempt 1' }));
    expect(screen.getByRole('button', { name: 'Back to progress' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Start test' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete all progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('button', { name: 'View progress' })).toBeNull();
  });
});
