import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { EXAMS } from './content/bank.ts';

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
});
