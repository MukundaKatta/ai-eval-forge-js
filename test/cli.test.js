import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "..", "src", "cli.js");

async function withTmp(run) {
  const dir = await mkdtemp(join(tmpdir(), "aef-cli-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("score: passing suite exits 0 with non-empty stdout", async () => {
  await withTmp(async (dir) => {
    const cases = [
      {
        id: "ok",
        actual: "Refunds within 30 days.",
        checks: [{ type: "contains", value: "30 days" }],
      },
    ];
    const file = join(dir, "cases.json");
    await writeFile(file, JSON.stringify(cases), "utf8");
    const out = spawnSync(process.execPath, [cliPath, "score", file], { encoding: "utf8" });
    assert.equal(out.status, 0, `stderr=${out.stderr}`);
    assert.ok(out.stdout.length > 0);
    assert.match(out.stdout, /Pass rate/);
  });
});

test("score: failing case exits 1", async () => {
  await withTmp(async (dir) => {
    const cases = [
      {
        id: "bad",
        actual: "nope",
        checks: [{ type: "contains", value: "missing" }],
      },
    ];
    const file = join(dir, "cases.json");
    await writeFile(file, JSON.stringify(cases), "utf8");
    const out = spawnSync(process.execPath, [cliPath, "score", file], { encoding: "utf8" });
    assert.equal(out.status, 1);
  });
});

test("score: --format json outputs valid JSON", async () => {
  await withTmp(async (dir) => {
    const cases = [
      { id: "j", actual: "x", checks: [{ type: "contains", value: "x" }] },
    ];
    const file = join(dir, "cases.jsonl");
    // JSONL form to also exercise the JSONL branch.
    await writeFile(file, cases.map((c) => JSON.stringify(c)).join("\n"), "utf8");
    const out = spawnSync(
      process.execPath,
      [cliPath, "score", file, "--format", "json"],
      { encoding: "utf8" },
    );
    assert.equal(out.status, 0, `stderr=${out.stderr}`);
    const parsed = JSON.parse(out.stdout);
    assert.equal(parsed.summary.total, 1);
    assert.equal(parsed.summary.passed, 1);
  });
});

test("--help prints usage", () => {
  const out = spawnSync(process.execPath, [cliPath, "--help"], { encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /Usage:/);
});

test("--version prints version from package.json", () => {
  const out = spawnSync(process.execPath, [cliPath, "--version"], { encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.match(out.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("--out writes report to file", async () => {
  await withTmp(async (dir) => {
    const file = join(dir, "cases.json");
    const out = join(dir, "report.md");
    await writeFile(
      file,
      JSON.stringify([{ id: "z", actual: "ok", checks: [{ type: "contains", value: "ok" }] }]),
      "utf8",
    );
    const res = spawnSync(
      process.execPath,
      [cliPath, "score", file, "--format", "markdown", "--out", out],
      { encoding: "utf8" },
    );
    assert.equal(res.status, 0, `stderr=${res.stderr}`);
    // stdout should be empty when --out is used.
    assert.equal(res.stdout, "");
    const { readFile } = await import("node:fs/promises");
    const written = await readFile(out, "utf8");
    assert.match(written, /Pass rate/);
  });
});
