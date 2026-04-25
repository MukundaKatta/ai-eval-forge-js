// ai-eval-forge - zero-dependency eval harness for LLM/agent regression testing.
// Public surface:
//   - evaluateSuite(cases, opts?) -> { results, summary }
//   - runCheck(check, ctx) -> { type, ok, message?, score? }
//   - registerCheck(type, fn)
//   - CHECKS (read-only-ish registry of built-in + custom checks)
//
// Result shape (per case):
//   { id, ok, checks: [{type, ok, message?, score?}], duration_ms }
// Summary shape:
//   { total, passed, failed, passRate, byCheckType: {[type]: {passed, failed}} }

import { exactCheck } from "./checks/exact.js";
import { containsCheck } from "./checks/contains.js";
import { regexCheck } from "./checks/regex.js";
import { tokenF1Check, tokenF1Score } from "./checks/tokenF1.js";
import { jsonValidCheck } from "./checks/jsonValid.js";
import { jsonFieldCheck } from "./checks/jsonField.js";
import { citationsCheck } from "./checks/citations.js";
import { exprCheck } from "./checks/expr.js";
import { formatMarkdown } from "./format/markdown.js";
import { formatJson } from "./format/json.js";

// Built-in check registry. Each entry takes (check, ctx) and returns
// { ok, score?, message? }. The runCheck wrapper adds the `type` field.
export const CHECKS = {
  exact: exactCheck,
  contains: containsCheck,
  regex: regexCheck,
  token_f1: tokenF1Check,
  json_valid: jsonValidCheck,
  json_field: jsonFieldCheck,
  citations: citationsCheck,
  expr: exprCheck,
};

// Allow user code to add custom checks at runtime.
export function registerCheck(type, fn) {
  if (typeof type !== "string" || type.length === 0) {
    throw new Error("registerCheck: type must be a non-empty string");
  }
  if (typeof fn !== "function") {
    throw new Error("registerCheck: fn must be a function");
  }
  CHECKS[type] = fn;
}

// Run a single check against a case context. Returns a normalized result with
// the type echoed back.
export function runCheck(check, ctx) {
  if (!check || typeof check.type !== "string") {
    return { type: "unknown", ok: false, message: "check missing 'type'" };
  }
  const fn = CHECKS[check.type];
  if (!fn) {
    return { type: check.type, ok: false, message: `unknown check type: ${check.type}` };
  }
  let raw;
  try {
    raw = fn(check, ctx) ?? {};
  } catch (err) {
    return { type: check.type, ok: false, message: `check threw: ${err.message}` };
  }
  const out = { type: check.type, ok: Boolean(raw.ok) };
  if (raw.message != null) out.message = String(raw.message);
  if (typeof raw.score === "number") out.score = raw.score;
  return out;
}

// Top-level entry point. Accepts an array OR a JSONL string (sniffed by the
// first non-whitespace character).
export function evaluateSuite(cases, opts = {}) {
  const list = normalizeInput(cases);
  const results = [];
  const byCheckType = {};
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const id = c.id ?? `case-${i}`;
    const ctx = {
      actual: stringifyForCheck(c.actual),
      expected: stringifyForCheck(c.expected),
      input: c.input,
      case: c,
    };
    const checks = Array.isArray(c.checks) ? c.checks : [];
    const checkResults = [];
    const start = nowMs();
    for (const check of checks) {
      const r = runCheck(check, ctx);
      checkResults.push(r);
      const bucket = (byCheckType[r.type] ??= { passed: 0, failed: 0 });
      if (r.ok) bucket.passed += 1;
      else bucket.failed += 1;
    }
    const duration_ms = Math.max(0, Math.round(nowMs() - start));
    // A case passes iff it has at least one check AND every check passes.
    // Cases with zero checks are reported as ok=true (nothing to fail) but the
    // user is responsible for catching that; empty suites are unusual.
    const ok = checkResults.length === 0 ? true : checkResults.every((r) => r.ok);
    if (ok) passed += 1;
    else failed += 1;
    results.push({ id, ok, checks: checkResults, duration_ms });
  }

  const total = results.length;
  const summary = {
    total,
    passed,
    failed,
    passRate: total === 0 ? 0 : passed / total,
    byCheckType,
  };
  return { results, summary };
}

// JSONL/array sniffing: strings starting with `[` are parsed as JSON arrays;
// any other non-empty string is treated as JSONL (one JSON object per line).
export function parseCases(input) {
  if (Array.isArray(input)) return input;
  if (typeof input !== "string") {
    throw new TypeError("parseCases: expected string or array");
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return [];
  if (trimmed[0] === "[") {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new TypeError("parseCases: JSON root must be an array");
    return parsed;
  }
  // JSONL: one object per non-empty line.
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

function normalizeInput(cases) {
  if (Array.isArray(cases)) return cases;
  if (typeof cases === "string") return parseCases(cases);
  throw new TypeError("evaluateSuite: cases must be an array or JSONL string");
}

// Many checks operate on string output; coerce non-strings to JSON for safety.
function stringifyForCheck(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function nowMs() {
  // performance.now is available in Node 18+; fall back for older runtimes.
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

// ---------------------------------------------------------------------------
// Backward-compat helpers exposed historically (kept for external scripts).
// ---------------------------------------------------------------------------

// Render a markdown report for a result returned by evaluateSuite.
export function renderMarkdown(result) {
  return formatMarkdown(result);
}

// Render a JSON string for a result returned by evaluateSuite.
export function renderJson(result) {
  return formatJson(result);
}

// Convenience re-export for callers that want the raw F1 helper.
export { tokenF1Score as tokenF1, formatMarkdown, formatJson };
