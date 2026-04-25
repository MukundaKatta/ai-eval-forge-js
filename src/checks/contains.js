// Substring check. Pass iff actual.includes(value).
// caseInsensitive: true makes the comparison case-insensitive.

export function containsCheck(check, ctx) {
  const value = check.value;
  if (value == null) {
    return { ok: false, score: 0, message: "contains: missing 'value'" };
  }
  const ci = check.caseInsensitive === true;
  const actual = ci ? String(ctx.actual ?? "").toLowerCase() : String(ctx.actual ?? "");
  const needle = ci ? String(value).toLowerCase() : String(value);
  const ok = actual.includes(needle);
  return {
    ok,
    score: ok ? 1 : 0,
    message: ok ? `found "${value}"` : `missing "${value}"`,
  };
}
