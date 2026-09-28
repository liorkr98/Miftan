/**
 * What the logs may carry. Request URLs and database errors both leak by
 * default: a /join/<token> path is a working invite for fourteen days, and a
 * failed query's message ends with its bound values — an email, a phone, a
 * password hash. Everything that reaches pino goes through these first.
 */

/** Path segments that are secrets in their own right. */
const SECRET_PATHS = [/^(\/join\/)[^/?#]+/, /^(\/auth\/(?:reset|verify)\/)[^/?#]+/];

export function redactUrl(url: string): string {
  const [path = '', query] = url.split('?', 2);
  let safePath = path;
  for (const re of SECRET_PATHS) safePath = safePath.replace(re, '$1[redacted]');
  /* Query values can be ids, emails or tokens; the keys are enough to debug. */
  if (query === undefined) return safePath;
  const keys = query
    .split('&')
    .map((pair) => pair.split('=')[0])
    .filter(Boolean);
  return keys.length ? `${safePath}?${keys.map((k) => `${k}=…`).join('&')}` : safePath;
}

/** Drizzle's "Failed query: … params: a,b,c" — keep the SQL, drop the values. */
export function scrubMessage(message: string): string {
  return message.replace(/params:[\s\S]*$/i, 'params: [redacted]');
}

interface LoggableError {
  type: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: LoggableError;
}

export function safeError(err: unknown, depth = 0): LoggableError {
  if (!(err instanceof Error)) return { type: typeof err, message: '[non-error thrown]' };
  const out: LoggableError = {
    type: err.name,
    message: scrubMessage(err.message),
    stack: err.stack ? scrubMessage(err.stack) : undefined,
  };
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string') out.code = code;
  /* A Postgres error's `detail` repeats the offending value
     ("Key (email)=(…) already exists"), so only the chain of causes is kept,
     each scrubbed the same way. */
  if (depth < 3 && err.cause !== undefined) out.cause = safeError(err.cause, depth + 1);
  return out;
}

export const logSerializers = {
  req(req: { method?: string; url?: string }) {
    return { method: req.method, url: redactUrl(req.url ?? '') };
  },
  err: safeError,
};
