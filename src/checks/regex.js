// Regex check. Pass iff new RegExp(pattern, flags).test(actual).

export function regexCheck(check, ctx) {
  const pattern = check.pattern ?? check.value;
  if (pattern == null) {
    return { ok: false, score: 0, message: "regex: missing 'pattern'" };
  }
  let regex;
  try {
    regex = new RegExp(pattern, check.flags ?? "");
  } catch (err) {
    return { ok: false, score: 0, message: `regex compile error: ${err.message}` };
  }
  const ok = regex.test(String(ctx.actual ?? ""));
  return {
    ok,
    score: ok ? 1 : 0,
    message: ok ? `matched /${pattern}/${check.flags ?? ""}` : `no match for /${pattern}/${check.flags ?? ""}`,
  };
}
