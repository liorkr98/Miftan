/**
 * @miftan/shared — the domain, with no platform in it.
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
export * from './api/tickets';
export * from './api/directory';
export * from './api/leads';
export * from './api/inquiries';
export * from './catalog/regions';
export * from './catalog/protocol-items';
export * from './catalog/contract-templates';
export * from './catalog/legal-content';
export * from './catalog/seasonal-templates';
export * from './lib/seasonal';
export * from './lib/budget';
export * from './lib/whatsapp';
export * from './api/budget';
export * from './api/search';
export * from './api/viewings';
export * from './api/reviews';
export * from './api/contract-templates';
export * from './api/seasonal';
export * from './api/protocols';
export * from './api/threads';
export * from './api/contracts';
export * from './api/rent-payments';
export * from './api/renter-profile';
export * from './api/properties-write';
export * from './api/client';
