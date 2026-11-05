import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('reports a browser with every required feature as ready', () => {
    vi.stubGlobal('Worker', class {});

    render(<App />);

    expect(screen.getByText('This browser is ready.')).toBeTruthy();
    expect(screen.getByText('Web Workers: ok')).toBeTruthy();
  });

  it('names the feature that is missing', () => {
    vi.stubGlobal('Worker', undefined);

    render(<App />);

    expect(screen.getByText('This browser is missing a required feature.')).toBeTruthy();
    expect(screen.getByText('Web Workers: unavailable')).toBeTruthy();
  });
});
