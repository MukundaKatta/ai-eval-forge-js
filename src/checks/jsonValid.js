// JSON validity. Pass iff JSON.parse(actual) does not throw.

export function jsonValidCheck(check, ctx) {
  try {
    JSON.parse(String(ctx.actual ?? ""));
    return { ok: true, score: 1, message: "valid JSON" };
  } catch (err) {
    return { ok: false, score: 0, message: `invalid JSON: ${err.message}` };
  }
}
