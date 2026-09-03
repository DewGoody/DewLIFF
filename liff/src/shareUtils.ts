/**
 * shareOrCopy — cross-env share fallback
 *
 * Priority:
 *   1. Inside LINE app  → caller handles shareTargetPicker (flex card)
 *   2. Browser with Web Share API (iOS Safari, Android Chrome) → native share sheet
 *   3. Anything else → clipboard copy
 *
 * Returns what actually happened so the caller can update UI status.
 */
export async function shareOrCopy(
  url: string,
  title?: string,
): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ url, title });
      return 'shared';
    }
  } catch {
    // User cancelled native share — don't fall through to clipboard
    return 'failed';
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
