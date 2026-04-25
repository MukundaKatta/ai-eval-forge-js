// SECURITY: this check evaluates arbitrary JavaScript via `new Function`.
// Do NOT use with untrusted cases. Treat it as a power-user feature only.
// The expression runs against a context object with: { actual, expected, input, case }.
// Truthy return = pass.

export function exprCheck(check, ctx) {
  const expr = check.expr ?? check.expression;
  if (typeof expr !== "string" || expr.length === 0) {
    return { ok: false, score: 0, message: "expr: missing 'expr'" };
  }
  try {
    // `with` is intentional - gives the expression direct access to the ctx
    // properties (actual, expected, input, case) without prefixes. The `case`
    // alias is offered because `case` is reserved and tricky to access via dot.
    // Note: `with` is incompatible with strict mode, so we deliberately leave
    // strict mode off here. This is a sloppy-mode evaluator by design.
    const fn = new Function("ctx", `with(ctx) { return (${expr}); }`);
    const value = fn({
      actual: ctx.actual,
      expected: ctx.expected,
      input: ctx.input,
      case: ctx.case,
    });
    const ok = Boolean(value);
    return {
      ok,
      score: ok ? 1 : 0,
      message: ok ? "expression truthy" : "expression falsy",
    };
  } catch (err) {
    return { ok: false, score: 0, message: `expr error: ${err.message}` };
  }
}
