#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { evaluateSuite, parseCases, renderMarkdown } from "./index.js";

async function main(argv = process.argv.slice(2)) {
  const [command, file, ...args] = argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }
  if (command !== "score") {
    console.error(`Unknown command: ${command}`);
    return 2;
  }
  if (!file) {
    console.error("Missing cases file.");
    return 2;
  }

  const format = readOption(args, "--format") ?? "json";
  const content = await readFile(file, "utf8");
  const result = evaluateSuite(parseCases(content));

  if (format === "markdown") {
    process.stdout.write(renderMarkdown(result));
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }

  return result.summary.failed ? 1 : 0;
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp() {
  console.log(`Usage: aef score <cases.json|cases.jsonl> [--format json|markdown]

Scores LLM or agent outputs with exact, contains, regex, JSON, citation, and token-F1 checks.`);
}

main().then((code) => {
  process.exitCode = code;
});

