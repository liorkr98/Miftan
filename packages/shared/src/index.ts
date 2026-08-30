/**
 * @miftach/shared — the domain, with no platform in it.
 *
 * Everything here is plain TypeScript that the API, the web app and (later) a
 * Capacitor wrapper all consume. One dictionary, one set of screening rules,
 * one source of truth for how money and dates are written.
 *
 * Nothing in this package may import from React, the DOM, or Node.
 */

export * from './types';
export * from './i18n/he';
export * from './lib/money';
export * from './lib/format';
export * from './lib/availability';
export * from './lib/screening';

/* API contract — one definition, used by the server to validate and by the
   client to type itself. */
export * from './api/errors';
export * from './api/schemas';
export * from './api/views';
export * from './api/client';
