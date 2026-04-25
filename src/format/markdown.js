// Markdown formatter. Produces a human-readable report:
//   - header summary table
//   - per-case bullet list with check rows underneath

export function formatMarkdown(result) {
  const { summary, results } = result;
  const lines = [];
  lines.push("# AI Eval Forge Report");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Total | ${summary.total} |`);
  lines.push(`| Passed | ${summary.passed} |`);
  lines.push(`| Failed | ${summary.failed} |`);
  lines.push(`| Pass rate | ${formatPct(summary.passRate)} |`);
  lines.push("");

  if (summary.byCheckType && Object.keys(summary.byCheckType).length > 0) {
    lines.push("## By check type");
    lines.push("");
    lines.push("| Type | Passed | Failed |");
    lines.push("| --- | ---: | ---: |");
    const keys = Object.keys(summary.byCheckType).sort();
    for (const k of keys) {
      const row = summary.byCheckType[k];
      lines.push(`| ${escape(k)} | ${row.passed} | ${row.failed} |`);
    }
    lines.push("");
  }

  lines.push("## Cases");
  lines.push("");
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    lines.push(`- ${escape(r.id)} - ${status} (${r.duration_ms}ms)`);
    for (const c of r.checks) {
      const cs = c.ok ? "ok" : "fail";
      const score = typeof c.score === "number" ? ` score=${c.score}` : "";
      const msg = c.message ? ` - ${c.message}` : "";
      lines.push(`  - ${escape(c.type)}: ${cs}${score}${msg}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function formatPct(n) {
  const pct = Math.round((Number(n) || 0) * 1000) / 10;
  return `${pct}%`;
}

function escape(s) {
  return String(s).replace(/\|/g, "\\|");
}
