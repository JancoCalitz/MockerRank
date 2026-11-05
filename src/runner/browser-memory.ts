// Each language asks the browser for WebAssembly memory, and a very long session in one page can use
// up what the browser allows. Only a new page gets it back, so this says so rather than blaming the
// internet connection or the candidate's code.
export const BROWSER_MEMORY_MESSAGE =
  'Your browser has run out of memory for running code. Reload this page to continue. Your work is saved.';

export function isBrowserMemoryFailure(message: string | undefined): boolean {
  return /could not allocate memory/i.test(message ?? '');
}
