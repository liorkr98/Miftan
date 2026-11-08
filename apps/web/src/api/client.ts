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
  /* Always this origin. Vite proxies /api to the API in development and the
     web Worker (apps/web/worker) does it when deployed, so the refresh cookie
     is first-party everywhere. Calling the API on its own hostname made the
     cookie third-party: lost on every reload, and blocked outright by Safari.
     There is deliberately no build-time override any more. */
  baseUrl: '/api',
  onSignedOut: () => {
    /* Assigned by AuthProvider once it is mounted. */
    signedOutHandler?.();
  },
});

let signedOutHandler: (() => void) | undefined;
export function onSignedOut(handler: () => void): void {
  signedOutHandler = handler;
}
