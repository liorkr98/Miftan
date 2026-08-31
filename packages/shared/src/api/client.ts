import { ApiError, type ApiErrorBody, type ErrorCode } from './errors';
import type { AuthResult, LoginInput, Me, RegisterInput } from './schemas';

/**
 * The typed client both the web app and any future wrapper use.
 *
 * Two things it handles so no caller has to:
 *  - the access token lives in memory, never in localStorage, because anything
 *    in localStorage is readable by any script that gets onto the page;
 *  - a 401 triggers exactly one refresh attempt, and concurrent calls that all
 *    401 share that single refresh rather than stampeding.
 */

export interface ClientOptions {
  baseUrl: string;
  /** Called whenever the session ends, so the app can route to login. */
  onSignedOut?: () => void;
}

export class MiftanClient {
  #baseUrl: string;
  #accessToken: string | null = null;
  #refreshing: Promise<boolean> | null = null;
  #onSignedOut?: () => void;

  constructor(opts: ClientOptions) {
    this.#baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.#onSignedOut = opts.onSignedOut;
  }

  get isAuthenticated(): boolean {
    return this.#accessToken !== null;
  }

  setAccessToken(token: string | null): void {
    this.#accessToken = token;
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (this.#accessToken) {
      headers.set('authorization', `Bearer ${this.#accessToken}`);
    }

    const res = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers,
      /* The refresh token is an httpOnly cookie; it has to ride along. */
      credentials: 'include',
    });

    if (res.status === 401 && retry) {
      const refreshed = await this.#refreshOnce();
      if (refreshed) return this.request<T>(path, init, false);
    }

    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;

    /* A static host with SPA fallback answers /api/anything with index.html and
       a cheerful 200. Parsing that as JSON throws somewhere far away from the
       cause, so name the cause here instead. */
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new ApiError(
        'api_unreachable',
        `expected JSON from ${this.#baseUrl}${path}, got ${contentType || 'no content type'}`,
      );
    }
    return (await res.json()) as T;
  }

  /** Concurrent 401s share one refresh instead of firing several. */
  #refreshOnce(): Promise<boolean> {
    this.#refreshing ??= (async () => {
      try {
        const res = await fetch(`${this.#baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) {
          this.#accessToken = null;
          this.#onSignedOut?.();
          return false;
        }
        const body = (await res.json()) as AuthResult;
        this.#accessToken = body.accessToken;
        return true;
      } catch {
        this.#accessToken = null;
        this.#onSignedOut?.();
        return false;
      } finally {
        this.#refreshing = null;
      }
    })();
    return this.#refreshing;
  }

  /* ── Auth ────────────────────────────────────────────── */

  async register(input: RegisterInput): Promise<AuthResult> {
    const r = await this.request<AuthResult>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false);
    this.#accessToken = r.accessToken;
    return r;
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const r = await this.request<AuthResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }, false);
    this.#accessToken = r.accessToken;
    return r;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' }, false);
    } finally {
      this.#accessToken = null;
      this.#onSignedOut?.();
    }
  }

  /** Called on boot: the cookie may still be valid from a previous visit. */
  async restore(): Promise<Me | null> {
    const ok = await this.#refreshOnce();
    if (!ok) return null;
    return this.me();
  }

  me(): Promise<Me> {
    return this.request<Me>('/me');
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body?.error?.code) {
      return new ApiError(body.error.code, body.error.message, body.error.details);
    }
  } catch {
    /* fall through to a generic error below */
  }
  const code: ErrorCode = res.status === 401 ? 'not_authenticated' : 'internal';
  return new ApiError(code, `${res.status} ${res.statusText}`);
}
