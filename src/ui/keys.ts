// Answer buttons (radios and checkboxes) do not count as typing.
const TYPING =
  'input:not([type="radio"], [type="checkbox"]), textarea, select, [contenteditable="true"], .monaco-editor';

// Single-key shortcuts must not fire while someone is typing, holds a modifier (so browser
// shortcuts such as Ctrl+F still work), or has a dialog open.
export function isShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return false;
  const target = event.target as HTMLElement | null;
  if (target?.closest(TYPING)) return false;
  return !document.querySelector('[role="dialog"]');
}
