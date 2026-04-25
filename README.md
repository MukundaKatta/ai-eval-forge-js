# @mukundakatta/ai-eval-forge

`ai-eval-forge` is a zero-dependency eval harness for LLM and agent regression testing.

It scores model outputs against mixed checks: exact match, substring, regex, token F1, JSON validity, JSON field equality, citation coverage, and custom JavaScript expressions.

## Install

```bash
npm install -g @mukundakatta/ai-eval-forge
```

## CLI

```bash
aef score cases.json --format markdown
```

`cases.json` can be an array or JSONL:

```json
[
  {
    "id": "refund-policy",
    "input": "Can I refund after 45 days?",
    "expected": "Refunds are available within 30 days.",
    "actual": "Refunds are only available within 30 days.",
    "checks": [
      { "type": "contains", "value": "30 days" },
      { "type": "token_f1", "min": 0.6 }
    ]
  }
]
```

## Library

```js
import { evaluateSuite } from "@mukundakatta/ai-eval-forge";

const result = evaluateSuite(cases);
console.log(result.summary.passRate);
```

## Checks reference

| Type | Required keys | Behavior |
| --- | --- | --- |
| `exact` | `value` (or `expected` on the case) | Trimmed string equality. |
| `contains` | `value` | Substring match; pass `caseInsensitive: true` to lowercase both sides. |
| `regex` | `pattern` (and optional `flags`) | `new RegExp(pattern, flags).test(actual)`. |
| `token_f1` | optional `min` (default 0.5) | Word-token F1 between `actual` and `expected`. |
| `json_valid` | none | `JSON.parse(actual)` does not throw. |
| `json_field` | `path`, `equals` | Parse JSON, walk dot-path (supports array indices like `items.0.name`), deep-equal to `equals`. |
| `citations` | `expected` (string array), optional `min` (default 1.0) | Each id appears in `actual` as `[id]`, `(id)`, or bare token. Coverage = found/expected. |
| `expr` | `expr` | Arbitrary JS evaluated against `{actual, expected, input, case}`. Truthy = pass. |

The `expr` check runs arbitrary JavaScript via `new Function` and is intentionally a power-user feature. Do not use it with untrusted cases.

## Programmatic check registration

You can register custom checks at runtime:

```js
import { evaluateSuite, registerCheck } from "@mukundakatta/ai-eval-forge";

registerCheck("len_at_least", (check, ctx) => {
  const min = check.min ?? 1;
  const ok = String(ctx.actual ?? "").length >= min;
  return { ok, score: ok ? 1 : 0, message: `len=${String(ctx.actual).length}` };
});

const result = evaluateSuite([
  {
    id: "long-enough",
    actual: "this is a long-enough answer",
    checks: [{ type: "len_at_least", min: 10 }],
  },
]);

console.log(result.summary.passRate); // 1
```

A check function receives `(check, ctx)` and returns `{ ok, score?, message? }`. The `ctx` object exposes `actual`, `expected`, `input`, and `case` (the raw case object).

