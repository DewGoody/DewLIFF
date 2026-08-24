export const PALETTE = ['#E63B2E', '#2563EB', '#16A34A', '#F5B800', '#8B5CF6', '#EC4899'];

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function scoreAnswers(
  questions: Array<{ options: Array<{ scores: Record<string, number> }> }>,
  axes: Array<{ id: string }>,
  answers: (number | undefined)[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  axes.forEach((a) => { totals[a.id] = 0; });
  answers.forEach((oi, qi) => {
    if (oi === undefined) return;
    const opt = questions[qi]?.options[oi];
    if (!opt) return;
    Object.entries(opt.scores).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; });
  });
  return totals;
}

export function topAxis(axes: Array<{ id: string }>, score: Record<string, number>): string | null {
  let best: string | null = null;
  axes.forEach((a) => {
    if (!best || (score[a.id] || 0) > (score[best] || 0)) best = a.id;
  });
  return best && (score[best] || 0) > 0 ? best : null;
}
