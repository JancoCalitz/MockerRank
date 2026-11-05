import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the result of the health check', async () => {
    const body = { status: 'ok', dependencies: { database: 'ok', judge0: 'unavailable' } };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(body)),
    );

    render(<App />);

    expect(await screen.findByText('API: ok')).toBeTruthy();
    expect(screen.getByText('judge0: unavailable')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('says so when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );

    render(<App />);

    expect(await screen.findByText('The API could not be reached.')).toBeTruthy();
  });
});
