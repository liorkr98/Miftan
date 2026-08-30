/**
 * @miftan/fixtures — the demo portfolio, as data.
 *
 * 22 real Tel Aviv / Ramat Gan / Givatayim addresses with honest coordinates,
 * 18 leases, 14 tickets with full message threads, 30 leads, and the seasonal
 * and protocol templates. Dates are all relative to load time, so the fixture
 * portfolio is alive whenever you seed it rather than expiring.
 *
 * Two consumers: `apps/api` seeds Postgres from it, and `apps/web` still
 * hydrates its mock store from it until Phase 5 moves the app onto the API.
 *
 * Protocol item templates, seasonal task templates, revenue streams and
 * affiliate offers live here permanently — they are configuration that ships
 * with the code, not rows anybody edits.
 */

export * from './clock';
export * from './people';
export * from './properties';
export * from './leases';
export * from './vendors';
export * from './tickets';
export * from './leads';
export * from './finance';
export * from './messages';
export * from './screening';
export * from './inquiries';
export * from './protocol';
export * from './seasonal';
export * from './revenue';
