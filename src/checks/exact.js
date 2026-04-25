// Strict equality on trimmed strings.
// Pass iff trim(actual) === trim(check.value ?? expected).

export function exactCheck(check, ctx) {
  const target = check.value ?? ctx.expected ?? "";
  const a = String(ctx.actual ?? "").trim();
  const b = String(target).trim();
  const ok = a === b;
  return {
    ok,
    score: ok ? 1 : 0,
    message: ok ? "exact match" : `expected "${b}", got "${a}"`,
  };
}
