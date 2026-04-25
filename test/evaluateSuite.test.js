import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSuite, registerCheck, CHECKS } from "../src/index.js";

const sampleArray = [
  {
    id: "refund-policy",
    expected: "Refunds are available within 30 days.",
    actual: "Refunds are only available within 30 days.",
    checks: [
      { type: "contains", value: "30 days" },
      { type: "token_f1", min: 0.6 },
    ],
  },
  {
    id: "json-shape",
    actual: '{"answer":"yes","ids":["a","b"]}',
    checks: [
      { type: "json_valid" },
      { type: "json_field", path: "answer", equals: "yes" },
    ],
  },
  {
    id: "intentional-fail",
    actual: "totally unrelated answer",
    expected: "exactly this",
    checks: [{ type: "exact" }],
  },
];

test("evaluateSuite accepts an array and computes summary", () => {
  const r = evaluateSuite(sampleArray);
  assert.equal(r.summary.total, 3);
  assert.equal(r.summary.passed, 2);
  assert.equal(r.summary.failed, 1);
  assert.equal(Math.round(r.summary.passRate * 1000) / 1000, 0.667);
  // Per-case shape
  for (const c of r.results) {
    assert.equal(typeof c.id, "string");
    assert.equal(typeof c.ok, "boolean");
    assert.ok(Array.isArray(c.checks));
    assert.equal(typeof c.duration_ms, "number");
    assert.ok(c.duration_ms >= 0);
  }
});

test("evaluateSuite accepts a JSONL string", () => {
  const lines = sampleArray.map((c) => JSON.stringify(c)).join("\n");
  const r = evaluateSuite(lines);
  assert.equal(r.summary.total, 3);
  assert.equal(r.summary.passed, 2);
});

test("byCheckType is populated and counts add up per type", () => {
  const r = evaluateSuite(sampleArray);
  const bct = r.summary.byCheckType;
  assert.ok(bct.contains);
  assert.equal(bct.contains.passed + bct.contains.failed, 1);
  assert.ok(bct.token_f1);
  assert.ok(bct.json_valid);
  assert.ok(bct.json_field);
  assert.ok(bct.exact);
  assert.equal(bct.exact.failed, 1);
});

test("evaluation is deterministic", () => {
  const a = evaluateSuite(sampleArray);
  const b = evaluateSuite(sampleArray);
  // Strip timing; duration_ms is allowed to vary.
  const strip = (r) => ({
    summary: r.summary,
    results: r.results.map((x) => ({ id: x.id, ok: x.ok, checks: x.checks })),
  });
  assert.deepEqual(strip(a), strip(b));
});

test("registerCheck adds a custom check usable by evaluateSuite", () => {
  registerCheck("len_at_least", (check, ctx) => {
    const min = check.min ?? 1;
    const ok = String(ctx.actual ?? "").length >= min;
    return { ok, score: ok ? 1 : 0, message: `len=${String(ctx.actual).length}` };
  });
  assert.ok(typeof CHECKS.len_at_least === "function");

  const r = evaluateSuite([
    {
      id: "long-enough",
      actual: "abcdefghij",
      checks: [{ type: "len_at_least", min: 5 }],
    },
    {
      id: "too-short",
      actual: "ab",
      checks: [{ type: "len_at_least", min: 5 }],
    },
  ]);
  assert.equal(r.summary.passed, 1);
  assert.equal(r.summary.failed, 1);
  assert.ok(r.summary.byCheckType.len_at_least);
});

test("empty checks array yields ok=true (nothing to fail)", () => {
  const r = evaluateSuite([{ id: "no-checks", actual: "x", checks: [] }]);
  assert.equal(r.results[0].ok, true);
  assert.equal(r.summary.passed, 1);
});

test("missing id is auto-assigned", () => {
  const r = evaluateSuite([{ actual: "x", checks: [{ type: "contains", value: "x" }] }]);
  assert.equal(r.results[0].id, "case-0");
});
