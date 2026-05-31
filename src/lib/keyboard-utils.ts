/** Returns true when an input-like element has focus, meaning keyboard shortcuts should be suppressed. */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest('[role="dialog"]')) return true;
  return false;
}
