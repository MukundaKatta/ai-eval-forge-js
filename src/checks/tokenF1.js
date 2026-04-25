// Token-level F1 between expected and actual.
// Tokenize on \w+, lowercase, compute precision/recall/F1.
// Pass iff F1 >= min (default 0.5). Reports score.

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .match(/\w+/g) ?? [];
}

export function tokenF1Score(actual, expected) {
  const a = tokenize(actual);
  const e = tokenize(expected);
  if (a.length === 0 && e.length === 0) return 1;
  if (a.length === 0 || e.length === 0) return 0;

  // Multiset overlap (count-aware) for fair F1.
  const counts = new Map();
  for (const tok of e) counts.set(tok, (counts.get(tok) ?? 0) + 1);
  let overlap = 0;
  for (const tok of a) {
    const c = counts.get(tok) ?? 0;
    if (c > 0) {
      overlap += 1;
      counts.set(tok, c - 1);
    }
  }
  if (overlap === 0) return 0;
  const precision = overlap / a.length;
  const recall = overlap / e.length;
  return (2 * precision * recall) / (precision + recall);
}

export function tokenF1Check(check, ctx) {
  const min = typeof check.min === "number" ? check.min : 0.5;
  const expected = check.expected ?? ctx.expected ?? "";
  const score = tokenF1Score(ctx.actual, expected);
  const ok = score >= min;
  return {
    ok,
    score: round(score, 4),
    message: `F1=${round(score, 4)} (min=${min})`,
  };
}

function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
