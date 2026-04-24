const DEFAULT_CHECKS = [{ type: "token_f1", min: 0.65 }];

function evaluateSuite(cases, options = {}) {
  const evaluated = cases.map((testCase, index) => evaluateCase(testCase, { ...options, index }));
  const passed = evaluated.filter((item) => item.passed).length;
  const failed = evaluated.length - passed;
  const scoreSum = evaluated.reduce((sum, item) => sum + item.score, 0);
  const costSum = evaluated.reduce((sum, item) => sum + (Number(item.meta.costUsd) || 0), 0);
  const latencySum = evaluated.reduce((sum, item) => sum + (Number(item.meta.latencyMs) || 0), 0);

  return {
    summary: {
      total: evaluated.length,
      passed,
      failed,
      passRate: evaluated.length ? passed / evaluated.length : 0,
      averageScore: evaluated.length ? scoreSum / evaluated.length : 0,
      totalCostUsd: round(costSum, 6),
      averageLatencyMs: evaluated.length ? Math.round(latencySum / evaluated.length) : 0,
    },
    cases: evaluated,
  };
}

function evaluateCase(testCase, options = {}) {
  const checks = testCase.checks?.length ? testCase.checks : DEFAULT_CHECKS;
  const actual = stringifyValue(testCase.actual ?? testCase.output ?? "");
  const expected = stringifyValue(testCase.expected ?? testCase.reference ?? "");
  const checkResults = checks.map((check) => runCheck(check, { actual, expected, testCase }));
  const requiredResults = checkResults.filter((result) => result.required);
  const passSet = requiredResults.length ? requiredResults : checkResults;
  const passed = passSet.every((result) => result.passed);
  const score = checkResults.length
    ? checkResults.reduce((sum, result) => sum + result.score, 0) / checkResults.length
    : 1;

  return {
    id: testCase.id ?? `case-${options.index ?? 0}`,
    passed,
    score: round(score, 4),
    checks: checkResults,
    meta: {
      input: testCase.input,
      tags: testCase.tags ?? [],
      costUsd: testCase.costUsd ?? testCase.meta?.costUsd ?? 0,
      latencyMs: testCase.latencyMs ?? testCase.meta?.latencyMs ?? 0,
    },
  };
}

function runCheck(check, context) {
  const required = check.required !== false;
  const type = check.type ?? "token_f1";
  const min = Number(check.min ?? 1);
  let score = 0;
  let detail = "";

  if (type === "exact") {
    score = normalize(context.actual) === normalize(check.value ?? context.expected) ? 1 : 0;
  } else if (type === "contains") {
    const values = arrayify(check.value ?? context.expected).map(String);
    const actual = check.caseSensitive ? context.actual : context.actual.toLowerCase();
    const hits = values.filter((value) => actual.includes(check.caseSensitive ? value : value.toLowerCase()));
    score = values.length ? hits.length / values.length : 1;
    detail = `${hits.length}/${values.length} substrings found`;
  } else if (type === "regex") {
    const regex = new RegExp(check.pattern ?? check.value, check.flags ?? "i");
    score = regex.test(context.actual) ? 1 : 0;
  } else if (type === "token_f1") {
    score = tokenF1(context.actual, check.value ?? context.expected);
    detail = `token_f1=${round(score, 4)}`;
  } else if (type === "json_valid") {
    score = parseJson(context.actual).ok ? 1 : 0;
  } else if (type === "json_field") {
    const parsed = parseJson(context.actual);
    const actualValue = parsed.ok ? getPath(parsed.value, check.path) : undefined;
    score = deepEqual(actualValue, check.value) ? 1 : 0;
    detail = `${check.path}=${JSON.stringify(actualValue)}`;
  } else if (type === "citation_coverage") {
    score = citationCoverage(context.actual, check.sources ?? context.testCase.sources ?? []);
    detail = `citation_coverage=${round(score, 4)}`;
  } else if (type === "js_expression") {
    score = runExpression(check.expression, context) ? 1 : 0;
  } else {
    throw new Error(`Unknown check type: ${type}`);
  }

  return {
    type,
    required,
    passed: score >= min,
    score: round(score, 4),
    min,
    detail,
  };
}

function tokenF1(actual, expected) {
  const actualTokens = tokenize(actual);
  const expectedTokens = tokenize(expected);
  if (!actualTokens.length && !expectedTokens.length) return 1;
  if (!actualTokens.length || !expectedTokens.length) return 0;

  const expectedCounts = counts(expectedTokens);
  let overlap = 0;
  for (const token of actualTokens) {
    if (expectedCounts.get(token) > 0) {
      overlap += 1;
      expectedCounts.set(token, expectedCounts.get(token) - 1);
    }
  }
  const precision = overlap / actualTokens.length;
  const recall = overlap / expectedTokens.length;
  return precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
}

function citationCoverage(actual, sources) {
  const ids = sources.map((source) => String(source.id ?? source)).filter(Boolean);
  if (!ids.length) return 1;
  const cited = ids.filter((id) => actual.includes(`[${id}]`) || actual.includes(`(${id})`) || actual.includes(id));
  return cited.length / ids.length;
}

function renderMarkdown(result) {
  const lines = [
    "# AI Eval Forge Report",
    "",
    `- Total: ${result.summary.total}`,
    `- Passed: ${result.summary.passed}`,
    `- Failed: ${result.summary.failed}`,
    `- Pass rate: ${Math.round(result.summary.passRate * 100)}%`,
    `- Average score: ${round(result.summary.averageScore, 4)}`,
    "",
    "| Case | Result | Score | Failed checks |",
    "| --- | --- | ---: | --- |",
  ];

  for (const testCase of result.cases) {
    const failed = testCase.checks.filter((check) => !check.passed).map((check) => check.type).join(", ");
    lines.push(`| ${escapeTable(testCase.id)} | ${testCase.passed ? "pass" : "fail"} | ${testCase.score} | ${escapeTable(failed || "-")} |`);
  }
  return `${lines.join("\n")}\n`;
}

function parseCases(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function runExpression(expression, context) {
  if (!expression || /(?:process|global|Function|eval|import|require)/.test(expression)) {
    throw new Error("Unsafe or empty js_expression");
  }
  const fn = new Function("actual", "expected", "testCase", `"use strict"; return (${expression});`);
  return Boolean(fn(context.actual, context.expected, context.testCase));
}

function tokenize(value) {
  return normalize(value).match(/[a-z0-9]+/g) ?? [];
}

function normalize(value) {
  return stringifyValue(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function counts(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1);
  return map;
}

function stringifyValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseJson(value) {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: undefined };
  }
}

function getPath(value, dottedPath) {
  return String(dottedPath ?? "").split(".").filter(Boolean).reduce((current, key) => current?.[key], value);
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function arrayify(value) {
  return Array.isArray(value) ? value : [value];
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|");
}

export {
  evaluateCase,
  evaluateSuite,
  parseCases,
  renderMarkdown,
  runCheck,
  tokenF1,
};

