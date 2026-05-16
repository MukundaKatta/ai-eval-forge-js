import vm from "node:vm";

const BLOCKED_EXPRESSION_PATTERN = /\b(?:process|globalThis|global|Function|eval|import|require|constructor|prototype|__proto__|this)\b/;
const EXPRESSION_TIMEOUT_MS = 50;

// The expression runs in a constrained VM context with:
// { actual, expected, input, testCase, ctx }.
// Truthy return = pass.

export function exprCheck(check, ctx) {
  const expr = String(check.expr ?? check.expression ?? "").trim();
  if (!expr) {
    return { ok: false, score: 0, message: "expr: missing 'expr'" };
  }
  if (BLOCKED_EXPRESSION_PATTERN.test(expr)) {
    return { ok: false, score: 0, message: "expr: unsafe expression" };
  }

  try {
    const testCase = JSON.parse(JSON.stringify(ctx.case ?? {}));
    const sandbox = vm.createContext(
      {
        actual: ctx.actual,
        expected: ctx.expected,
        input: ctx.input,
        testCase,
        ctx: {
          actual: ctx.actual,
          expected: ctx.expected,
          input: ctx.input,
          case: testCase,
        },
      },
      {
        name: "ai-eval-forge-expression",
        codeGeneration: { strings: false, wasm: false },
      },
    );
    const script = new vm.Script(`"use strict"; (${expr})`);
    const value = script.runInContext(sandbox, { timeout: EXPRESSION_TIMEOUT_MS });
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
