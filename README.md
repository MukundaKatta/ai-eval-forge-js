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

