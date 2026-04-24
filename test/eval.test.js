import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSuite, parseCases, renderMarkdown, tokenF1 } from "../src/index.js";

test("tokenF1 scores overlap", () => {
  assert.equal(tokenF1("refund within 30 days", "refunds are available within 30 days") >= 0.6, true);
});

test("evaluateSuite supports mixed checks", () => {
  const result = evaluateSuite([
    {
      id: "json-answer",
      actual: "{\"answer\":\"yes\",\"source_ids\":[\"a\"]}",
      checks: [
        { type: "json_valid" },
        { type: "json_field", path: "answer", value: "yes" },
      ],
    },
    {
      id: "grounded",
      actual: "Refunds are available for 30 days [policy].",
      expected: "Refunds are available within 30 days.",
      sources: [{ id: "policy" }],
      checks: [
        { type: "contains", value: "30 days" },
        { type: "citation_coverage", min: 1 },
        { type: "token_f1", min: 0.5 },
      ],
    },
  ]);

  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.failed, 0);
  assert.match(renderMarkdown(result), /AI Eval Forge Report/);
});

test("parseCases accepts jsonl", () => {
  const cases = parseCases('{"id":"one","actual":"a"}\n{"id":"two","actual":"b"}\n');
  assert.equal(cases.length, 2);
});
