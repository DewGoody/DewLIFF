/** Get axis card image URL — config takes priority over any hardcoded default */
export function getAxisCard(
  axisId: string,
  configAxes?: Array<{ id: string; image_url?: string }>,
): string {
  return configAxes?.find(a => a.id === axisId)?.image_url ?? '';
}

/** Resolve a label string (Thai label, EN label, or axis id) to a canonical axis id.
 *  Always pass configAxes so this works correctly across any campaign. */
export function findAxisId(
  label: string,
  configAxes?: Array<{ id: string; label?: string; label_en?: string }>,
): string | undefined {
  if (!label) return undefined;
  if (configAxes) {
    const found = configAxes.find(a =>
      a.id === label ||
      a.label === label ||
      a.label_en === label ||
      a.label_en?.toLowerCase() === label.toLowerCase()
    );
    if (found) return found.id;
  }
  return undefined;
}
