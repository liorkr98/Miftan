import { MiftanClient } from '@miftan/shared';

/**
 * One client for the whole app.
 *
 * The access token lives in memory on this instance and nowhere else — not in
 * localStorage, which any injected script can read. Surviving a page reload is
 * the refresh cookie's job, and the cookie is httpOnly so the same script
 * cannot touch that either.
 */
export const api = new MiftanClient({
  /* Same-origin by default: Vite proxies /api to the API in development, and
     in production the two sit behind one hostname. Cross-origin would mean the
     sameSite=lax refresh cookie never gets sent. */
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  onSignedOut: () => {
    /* Assigned by AuthProvider once it is mounted. */
    signedOutHandler?.();
  },
});

let signedOutHandler: (() => void) | undefined;
export function onSignedOut(handler: () => void): void {
  signedOutHandler = handler;
}
