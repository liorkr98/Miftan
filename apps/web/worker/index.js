/**
 * The web app's Worker: the static files, the API, and the listing preview.
 *
 * /api/*  is the API itself, run in-process (apps/api/src/worker.ts) against
 * the D1 database and R2 bucket bound below in wrangler.jsonc. The browser
 * only ever talks to this one origin, so the refresh cookie is first-party,
 * SameSite=lax is enough, and no browser's third-party cookie blocking
 * (Safari blocks them outright) can drop it.
 *
 * /l/:id  is the public listing page.
 *
 * WhatsApp, Facebook and Telegram build their preview card from the page's
 * <meta> tags and never run its JavaScript, so a single-page app shows every
 * link with the same generic card. For a listing, this Worker asks the API
 * for the public view of the unit (exactly what any stranger may see) and
 * writes the title, description and cover photo into index.html before it
 * leaves. If anything fails, the plain page is served unchanged.
 */

import { handleApi } from '../../api/src/worker.ts';
/* Rendered by `npm run build` (apps/api/scripts/render-demo-seed.ts). Loaded
   only into an empty database, and only with DEMO_DATABASE=true. */
import demoSeed from '../../api/.demo/seed.json';

const bindingsOf = (env) => ({ ...env, DEMO_SEED: demoSeed });

const LISTING = /^\/l\/([A-Za-z0-9_-]{3,64})\/?$/;

const AVAILABILITY = {
  now: 'פנויה עכשיו',
  dated: 'מתפנה בתאריך ידוע',
  extending: 'מושכרת',
  unknown: 'מושכרת',
};

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const shekels = (agorot) => `₪${Math.round(agorot / 100).toLocaleString('he-IL')}`;

function rooms(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function dateHe(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

async function listingCard(request, env, url, id) {
  const path = `/properties/${encodeURIComponent(id)}`;
  const res = await handleApi(
    new Request(new URL(`/api${path}`, url), { headers: { accept: 'application/json', 'cf-connecting-ip': request.headers.get('cf-connecting-ip') ?? '' } }),
    bindingsOf(env),
    path,
  );
  if (!res.ok) return null;
  const p = await res.json();
  if (p.scope !== 'public') return null;

  const a = p.address;
  const title = `${rooms(p.rooms)} חדרים ברחוב ${a.street}, ${a.city} · ${shekels(p.monthlyRentAgorot)}`;
  const availability =
    p.availability.kind === 'dated' && p.availability.date
      ? `מתפנה ב־${dateHe(p.availability.date)}`
      : AVAILABILITY[p.availability.kind] ?? '';
  const description = [a.neighborhood, `${p.sqm} מ״ר`, `קומה ${p.floor}`, availability]
    .filter(Boolean)
    .join(' · ');
  /* Stored photos come back as same-origin links; a crawler needs the whole URL. */
  const image = p.photos[0] ? new URL(p.photos[0], url).toString() : null;
  return { title, description, image };
}

const unavailable = () =>
  new Response(JSON.stringify({ error: { code: 'api_unreachable', message: 'the API could not start' } }), {
    status: 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function api(request, env, url) {
  try {
    return await handleApi(request, bindingsOf(env), (url.pathname.slice(4) || '/') + url.search);
  } catch (err) {
    /* Migrations or the signing key failed to load: say so as JSON, which
       the client shows as "no connection" rather than a blank page. */
    console.error('api failed before handling the request', err);
    return unavailable();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return api(request, env, url);
    }
    const match = url.pathname.match(LISTING);
    if (!match) return env.ASSETS.fetch(request);

    /* The app shell, whatever path was asked for. */
    const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));

    let card = null;
    try {
      card = await listingCard(request, env, url, match[1]);
    } catch {
      card = null;
    }
    if (!card) return page;

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:locale" content="he_IL" />`,
      `<meta property="og:site_name" content="בעל הבית" />`,
      `<meta property="og:title" content="${escape(card.title)}" />`,
      `<meta property="og:description" content="${escape(card.description)}" />`,
      `<meta property="og:url" content="${escape(url.origin + url.pathname)}" />`,
      card.image ? `<meta property="og:image" content="${escape(card.image)}" />` : '',
      `<meta name="twitter:card" content="${card.image ? 'summary_large_image' : 'summary'}" />`,
    ].join('');

    return new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(card.title);
        },
      })
      .on('meta[name="description"]', {
        element(el) {
          el.setAttribute('content', card.description);
        },
      })
      .on('head', {
        element(el) {
          el.append(tags, { html: true });
        },
      })
      .transform(page);
  },
};
