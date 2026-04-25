#!/usr/bin/env node
// aef - score eval cases from a JSON or JSONL file.
//
//   aef score <cases.json|.jsonl> [--format markdown|json] [--out <path>] [--strict]
//   aef --help
//   aef --version
//
// Exits 0 if all cases pass. Exits 1 if any case fails. With --strict, exits 1
// when any check carries a non-fatal warning (currently mirrors the failure
// signal; reserved for future "warning" semantics so callers can wire CI now).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

import { evaluateSuite, parseCases } from "./index.js";
import { formatMarkdown } from "./format/markdown.js";
import { formatJson } from "./format/json.js";

async function readVersion() {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "package.json");
  const raw = await readFile(pkgPath, "utf8");
  return JSON.parse(raw).version;
}

function printHelp() {
  const help = `aef - eval scoring CLI for ai-eval-forge

Usage:
  aef score <cases.json|.jsonl> [options]
  aef --help
  aef --version

Options:
  --format <markdown|json>   Output format (default: markdown)
  --out <path>               Write output to file instead of stdout
  --strict                   Exit non-zero on warnings as well as failures

Examples:
  aef score cases.json --format markdown
  aef score cases.jsonl --format json --out report.json
`;
  process.stdout.write(help);
}

// Hand-rolled arg parser. Recognizes:
//   --flag           -> { flag: true }
//   --opt value      -> { opt: "value" }
//   --opt=value      -> { opt: "value" }
// Positional args are collected into args._.
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next != null && !next.startsWith("--")) {
          out[key] = next;
          i += 1;
        } else {
          out[key] = true;
        }
      }
    } else if (a.startsWith("-") && a.length > 1) {
      // Short flags: only -h handled explicitly.
      const key = a.slice(1);
      out[key] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    const v = await readVersion();
    process.stdout.write(`${v}\n`);
    return 0;
  }

  const command = argv[0];
  const rest = argv.slice(1);

  if (command !== "score") {
    process.stderr.write(`unknown command: ${command}\n\n`);
    printHelp();
    return 2;
  }

  const args = parseArgs(rest);
  const file = args._[0];
  if (!file) {
    process.stderr.write("score: missing <cases.json|.jsonl>\n");
    return 2;
  }

  const format = (args.format ?? "markdown").toString();
  if (format !== "markdown" && format !== "json") {
    process.stderr.write(`score: invalid --format "${format}" (expected markdown|json)\n`);
    return 2;
  }

  let content;
  try {
    content = await readFile(resolve(file), "utf8");
  } catch (err) {
    process.stderr.write(`score: cannot read "${file}": ${err.message}\n`);
    return 2;
  }

  let cases;
  try {
    cases = parseCases(content);
  } catch (err) {
    process.stderr.write(`score: cannot parse cases: ${err.message}\n`);
    return 2;
  }

  const result = evaluateSuite(cases);
  const rendered = format === "markdown" ? formatMarkdown(result) : formatJson(result);
  // Ensure trailing newline so cat/diff output stays sane.
  const output = rendered.endsWith("\n") ? rendered : `${rendered}\n`;

  if (args.out) {
    try {
      await writeFile(resolve(String(args.out)), output, "utf8");
    } catch (err) {
      process.stderr.write(`score: cannot write "${args.out}": ${err.message}\n`);
      return 2;
    }
  } else {
    process.stdout.write(output);
  }

  // Exit policy: any failed case -> 1. --strict currently behaves the same;
  // reserved as a forward-compatible flag once warnings are introduced.
  if (result.summary.failed > 0) return 1;
  if (args.strict && result.summary.total === 0) return 1;
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((err) => {
    process.stderr.write(`aef: unexpected error: ${err?.stack ?? err}\n`);
    process.exitCode = 2;
  });
