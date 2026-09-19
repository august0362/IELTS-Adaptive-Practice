/**
 * Shared helper for parsing a JSON request body in API route handlers.
 *
 * `Request.json()` throws a SyntaxError on malformed/empty JSON, which — if
 * left uncaught inside a route handler — bubbles up as an unhandled 500
 * instead of a proper 400. It also resolves fine for a body that parses to
 * `null` or a non-object JSON value (e.g. `null`, `42`, `"foo"`), which then
 * crashes route code that does `body.someField` directly.
 *
 * `readJsonObject` handles both cases: it never throws, and always resolves
 * to a plain object (defaulting to `{}`) so callers can safely destructure
 * fields off the result without a null-check at every call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonBodyResult = { ok: true; body: Record<string, any> } | { ok: false };

export async function readJsonObject(request: Request): Promise<JsonBodyResult> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return { ok: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = data !== null && typeof data === "object" ? (data as Record<string, any>) : {};
  return { ok: true, body };
}
