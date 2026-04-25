import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSuite, formatMarkdown, formatJson } from "../src/index.js";

const cases = [
  {
    id: "alpha",
    actual: "Refunds within 30 days.",
    expected: "Refunds are within 30 days.",
    checks: [
      { type: "contains", value: "30 days" },
      { type: "token_f1", min: 0.5 },
    ],
  },
  {
    id: "beta",
    actual: "wrong",
    expected: "right",
    checks: [{ type: "exact" }],
  },
];

test("markdown report contains 'Pass rate' and each case id", () => {
  const result = evaluateSuite(cases);
  const md = formatMarkdown(result);
  assert.match(md, /Pass rate/);
  assert.match(md, /alpha/);
  assert.match(md, /beta/);
  // Per-check rows render under the case bullets.
  assert.match(md, /token_f1/);
  assert.match(md, /contains/);
  assert.match(md, /exact/);
});

test("json output round-trips and matches the result object", () => {
  const result = evaluateSuite(cases);
  const j = formatJson(result);
  const parsed = JSON.parse(j);
  // duration_ms varies; just check structure.
  assert.equal(parsed.summary.total, result.summary.total);
  assert.equal(parsed.summary.passed, result.summary.passed);
  assert.equal(parsed.summary.failed, result.summary.failed);
  assert.equal(parsed.results.length, result.results.length);
  for (let i = 0; i < parsed.results.length; i++) {
    assert.equal(parsed.results[i].id, result.results[i].id);
    assert.equal(parsed.results[i].ok, result.results[i].ok);
    assert.equal(parsed.results[i].checks.length, result.results[i].checks.length);
  }
});
