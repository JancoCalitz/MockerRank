export {};

// In the app, a problem's code loads when it is opened. Tests read it directly, so load it all first.
if (typeof localStorage !== 'undefined') {
  const { loadAllProblemCode } = await import('./content/bank.ts');
  await loadAllProblemCode();
}
