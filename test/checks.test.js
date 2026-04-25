import test from "node:test";
import assert from "node:assert/strict";

import { runCheck } from "../src/index.js";

// Each test exercises one passing and one failing case for every check type.

test("exact: pass on trimmed equality", () => {
  const r = runCheck(
    { type: "exact", value: "hello" },
    { actual: "  hello  ", expected: "" },
  );
  assert.equal(r.ok, true);
  assert.equal(r.type, "exact");
});

test("exact: fail on mismatch", () => {
  const r = runCheck(
    { type: "exact", value: "hello" },
    { actual: "world", expected: "" },
  );
  assert.equal(r.ok, false);
});

test("contains: pass when substring present", () => {
  const r = runCheck(
    { type: "contains", value: "30 days" },
    { actual: "Refunds are within 30 days." },
  );
  assert.equal(r.ok, true);
});

test("contains: fail when missing; case-insensitive flag flips result", () => {
  const miss = runCheck(
    { type: "contains", value: "REFUND" },
    { actual: "refund policy" },
  );
  assert.equal(miss.ok, false);
  const hit = runCheck(
    { type: "contains", value: "REFUND", caseInsensitive: true },
    { actual: "refund policy" },
  );
  assert.equal(hit.ok, true);
});

test("regex: pass on match", () => {
  const r = runCheck(
    { type: "regex", pattern: "^\\d{3}-\\d{4}$" },
    { actual: "555-1212" },
  );
  assert.equal(r.ok, true);
});

test("regex: fail on no match", () => {
  const r = runCheck(
    { type: "regex", pattern: "^\\d{3}$" },
    { actual: "abc" },
  );
  assert.equal(r.ok, false);
});

test("token_f1: pass when overlap meets min", () => {
  const r = runCheck(
    { type: "token_f1", min: 0.5 },
    { actual: "refunds within 30 days", expected: "refunds are available within 30 days" },
  );
  assert.equal(r.ok, true);
  assert.equal(typeof r.score, "number");
});

test("token_f1: fail on disjoint tokens", () => {
  const r = runCheck(
    { type: "token_f1", min: 0.5 },
    { actual: "alpha beta gamma", expected: "delta epsilon zeta" },
  );
  assert.equal(r.ok, false);
});

test("json_valid: pass on parseable JSON", () => {
  const r = runCheck({ type: "json_valid" }, { actual: '{"a":1}' });
  assert.equal(r.ok, true);
});

test("json_valid: fail on garbage", () => {
  const r = runCheck({ type: "json_valid" }, { actual: "not json {" });
  assert.equal(r.ok, false);
});

test("json_field: pass with dot-path equality (incl. array index)", () => {
  const r = runCheck(
    { type: "json_field", path: "items.0.name", equals: "alpha" },
    { actual: '{"items":[{"name":"alpha"},{"name":"beta"}]}' },
  );
  assert.equal(r.ok, true);
});

test("json_field: fail when path/value mismatch", () => {
  const r = runCheck(
    { type: "json_field", path: "answer", equals: "yes" },
    { actual: '{"answer":"no"}' },
  );
  assert.equal(r.ok, false);
});

test("citations: pass when all expected ids appear", () => {
  const r = runCheck(
    { type: "citations", expected: ["doc1", "doc7"] },
    { actual: "Per [doc1] and (doc7), refunds are available." },
  );
  assert.equal(r.ok, true);
});

test("citations: fail when below min coverage", () => {
  const r = runCheck(
    { type: "citations", expected: ["doc1", "doc2", "doc3"], min: 1.0 },
    { actual: "Only [doc1] cited here." },
  );
  assert.equal(r.ok, false);
});

test("expr: pass when expression returns truthy", () => {
  const r = runCheck(
    { type: "expr", expr: "actual.length > 0 && actual.includes('ok')" },
    { actual: "looks ok", expected: "", input: undefined, case: {} },
  );
  assert.equal(r.ok, true);
});

test("expr: fail when expression returns falsy or throws", () => {
  const falsy = runCheck(
    { type: "expr", expr: "false" },
    { actual: "", expected: "", input: undefined, case: {} },
  );
  assert.equal(falsy.ok, false);
  const broken = runCheck(
    { type: "expr", expr: "doesNotExist.something" },
    { actual: "", expected: "", input: undefined, case: {} },
  );
  assert.equal(broken.ok, false);
});

test("unknown check type fails gracefully", () => {
  const r = runCheck({ type: "made_up" }, { actual: "x" });
  assert.equal(r.ok, false);
  assert.match(r.message, /unknown/i);
});
