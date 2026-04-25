// Citation coverage. Given expected citation ids, ensure each appears in actual
// (e.g. as `[doc1]`, `(doc1)`, or bare `doc1`). Coverage = found/expected;
// pass iff >= min (default 1.0).

export function citationsCheck(check, ctx) {
  const expected = collectIds(check);
  if (expected.length === 0) {
    // Treat empty expectation as trivially satisfied so suites don't surprise users.
    return { ok: true, score: 1, message: "no citations expected" };
  }
  const min = typeof check.min === "number" ? check.min : 1.0;
  const actual = String(ctx.actual ?? "");
  const found = expected.filter((id) => containsCitation(actual, id));
  const coverage = found.length / expected.length;
  const ok = coverage >= min;
  return {
    ok,
    score: round(coverage, 4),
    message: `cited ${found.length}/${expected.length} (min=${min})`,
  };
}

function collectIds(check) {
  // Accept several common shapes: expected: ["doc1"], ids: [...], value: [...],
  // or sources: [{id: "doc1"}, "doc2"].
  const raw = check.expected ?? check.ids ?? check.value ?? check.sources ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (s && typeof s === "object" ? s.id : s))
    .map((s) => (s == null ? "" : String(s)))
    .filter((s) => s.length > 0);
}

function containsCitation(actual, id) {
  if (actual.includes(`[${id}]`)) return true;
  if (actual.includes(`(${id})`)) return true;
  // Bare id with word-ish boundaries; escape regex specials.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\w])${escaped}(?:$|[^\\w])`).test(actual);
}

function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
