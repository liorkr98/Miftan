/**
 * The error envelope.
 *
 * The API returns machine-readable codes, never Hebrew. The client maps a code
 * to a string from the dictionary, which is what keeps the i18n seam intact:
 * an Arabic or Russian build gets translated errors without the server
 * changing a line.
 */
export const ERROR_CODES = [
  'invalid_credentials',
  'email_taken',
  'not_authenticated',
  'session_expired',
  'session_reused',
  'forbidden',
  'not_found',
  'validation_failed',
  'rate_limited',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** English, for logs and developers. Never shown to a user. */
    message: string;
    /** Field-level detail for validation failures */
    details?: Record<string, string[]>;
  };
}

/** HTTP status for each code, so both sides agree without a lookup table. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  invalid_credentials: 401,
  email_taken: 409,
  not_authenticated: 401,
  session_expired: 401,
  session_reused: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  /* Written out rather than declared as constructor parameter properties:
     `erasableSyntaxOnly` requires TypeScript that strips to nothing, and
     parameter properties emit real assignments. */
  readonly code: ErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, string[]>) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
