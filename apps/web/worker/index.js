/**
 * The web app's Worker. Everything is served as static files except /l/:id,
 * the public listing page, which runs through here first.
 *
 * WhatsApp, Facebook and Telegram build their preview card from the page's
 * <meta> tags and never run its JavaScript, so a single-page app shows every
 * link with the same generic card. For a listing, this Worker asks the API
 * for the public view of the unit (exactly what any stranger may see) and
 * writes the title, description and cover photo into index.html before it
 * leaves. If anything fails, the plain page is served unchanged.
 */

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

async function listingCard(env, id) {
  const res = await fetch(`${env.API_URL}/properties/${encodeURIComponent(id)}`, {
    headers: { accept: 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
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
  return { title, description, image: p.photos[0] ?? null };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(LISTING);
    if (!match) return env.ASSETS.fetch(request);

    /* The app shell, whatever path was asked for. */
    const page = await env.ASSETS.fetch(new Request(new URL('/', url), request));

    let card = null;
    try {
      card = await listingCard(env, match[1]);
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
