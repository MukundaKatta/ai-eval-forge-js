// JSON field equality. Parse JSON, walk dot-path, compare to `equals`.
// Path supports nested keys and array indices: "a.b.c", "items.0.name".

export function jsonFieldCheck(check, ctx) {
  const path = check.path;
  if (typeof path !== "string" || path.length === 0) {
    return { ok: false, score: 0, message: "json_field: missing 'path'" };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(ctx.actual ?? ""));
  } catch (err) {
    return { ok: false, score: 0, message: `json_field: invalid JSON (${err.message})` };
  }
  const value = walkPath(parsed, path);
  const target = check.equals;
  const ok = deepEqual(value, target);
  return {
    ok,
    score: ok ? 1 : 0,
    message: ok
      ? `${path} == ${JSON.stringify(target)}`
      : `${path}=${JSON.stringify(value)} (expected ${JSON.stringify(target)})`,
  };
}

function walkPath(root, path) {
  const parts = path.split(".").filter((p) => p.length > 0);
  let cur = root;
  for (const part of parts) {
    if (cur == null) return undefined;
    // Numeric index supports arrays: "items.0.name".
    if (Array.isArray(cur) && /^\d+$/.test(part)) {
      cur = cur[Number(part)];
    } else {
      cur = cur[part];
    }
  }
  return cur;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
  return true;
}
