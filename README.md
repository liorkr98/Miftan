# מפתן · Miftan

Israeli rental ops plus a time-based marketplace. Hebrew UI, RTL.

Yad2 shows flights already boarding; מפתן shows the schedule. Occupied units
with a known free-date are the inventory. Privacy is shape, not a filter:
seeker → owner → tenant → owner → seeker, and the two ends never meet.

The API (Fastify + Postgres) and the privacy layer are in place. Most screens
read the API. Revenue (`/owner/revenue`) stays on fixtures on purpose — wiring
it would imply the numbers are measured.

---

## Run it

Postgres must be up. Then, once:

```bash
npm install
cd apps/api && npm run db:reset && npm run db:migrate && npm run db:seed
```

```bash
# API
cd apps/api && npm run dev          # http://127.0.0.1:4000

# Web (separate terminal, from the repo root)
npm run dev -w @miftan/web          # http://localhost:5178
```

The web dev server proxies `/api` → `127.0.0.1:4000`, so the app and API are
same-origin. **Do not change that** — the refresh cookie is `sameSite=lax` and
a cross-origin setup silently breaks session persistence on reload.

Password for every seeded account: `miftan-dev-2026`

| Account | Email | Holds |
|---|---|---|
| Owner | `ran@almog-nadlan.co.il` | 22 properties |
| Tenant | `michal.stern@gmail.com` | 1 lease |
| Seeker | `tal.aviram@gmail.com` | queue rows only |
| **All three** | `dana@miftan-demo.co.il` | owns 3, rents 1, queues for 2 |

Test with Dana. It is the only account that holds all three relationships.

```bash
npm run typecheck
npm run build
npm run test
```

## Renaming the app

`APP_NAME` in [`packages/shared/src/i18n/he.ts`](packages/shared/src/i18n/he.ts)
is the single source. Change it there and the top bar, page title and copy follow.

---

## The three personas

A role switcher in the top bar offers only the relationships the signed-in
account actually holds. Each persona is deep-linkable:

| Persona | Routes | Shape |
|---|---|---|
| בעל דירות | `/owner/*` | Side rail, dense. A workstation. |
| דייר | `/tenant/*` | No rail, large destinations. A consumer app. |
| מחפש דירה | `/search/*` | No chrome in the way of the map. A browser. |

Switching persona routes to that persona's root rather than mapping to an
"equivalent" screen — there is no equivalence between a portfolio board and a
search map, and pretending otherwise would misrepresent the product.

---

## The five flows that must work end to end

**Maintenance.** Tenant opens a ticket with a photo → owner approves → owner
picks a vendor from the directory (filtered to the right trade and service area)
→ vendor gets a slot from the tenant's stated availability → tenant confirms
they'll be home → receipt is uploaded → **an expense is auto-created against the
unit** and the ticket closes.

**Queue.** Seeker filters by `זמין החל מ־` (a date, not a boolean) → opens an
occupied apartment with a known free-date → fills a renter profile → `שריין מקום בתור`
→ the lead appears in the owner's CRM, scored against the active screening
preset, with an audit entry written. Leaving the queue moves everyone behind
you up. `POST /leads` refuses an incomplete profile.

**Availability inquiry.** This is the one that makes undecided apartments
useful. A seeker opens a unit whose tenant hasn't decided → `שאל מתי הדירה
תתפנה` → the request lands on the owner's board → owner forwards **one
question** to the tenant → the tenant answers (`מאריך` / `עוזב` / `לא בטוח` /
`מוקדם מדי להחליט`, plus an optional private note) → the owner gets a
pre-written reply to edit and sends it → the seeker sees the answer and the
unit now carries a **projected** date.

The seeker and the tenant never touch. The tenant sees a question about their
own lease, never a person; the seeker sees a date, never an identity.

**Contract intake.** Pick a unit → upload → staged pipeline (upload → read →
extract → your review) → every field comes back with a confidence score and a
source hint → edit anything → commit writes to the lease. Extraction sits
behind an interface; an LLM can slot in later. The scan is not "AI".

**Preventive maintenance.** Seasonal templates fan out across eligible units.
Scheduling opens a real ticket, so preventive work lives in the same board as
reactive work.

---

## What is still mocked, and what is not

| Area | Now |
|---|---|
| **Persistence** | Postgres. Mixed-scope lists; money as integer agorot. |
| **Auth** | Refresh-rotating sessions. Roles are relationships, not a column. |
| **Photo & receipt uploads** | Presigned R2 (or local disk in development). |
| **Rent payments** | `GET /rent-payments` — owner roll and tenant history. Nothing charges anything. |
| **Renter profile** | `GET/PATCH /me/renter-profile`. Completeness gates queue join. |
| **Property create / listed** | `POST/PATCH /properties`. Photos via `PUT /properties/:id/photos`. |
| **Notifications** | Toasts only. WhatsApp/SMS is Phase 7 (Meta Business verification). |
| **Revenue model** | `/owner/revenue` is **deliberately** still fixtures. Do not wire it. |
| **Yad2 / Madlan ingestion** | None. Comparables come from the owner's own portfolio. |
| **Contract OCR** | Extractor interface; default implementation is deterministic, not an LLM. |
| **Affiliate fulfilment** | `requestOffer()` is still a toast. Provider names are placeholders. |

`resetDemo()` (top bar → אפס הדגמה) restores the in-memory fixture store **and**
clears the React Query cache. It does not reseed Postgres.

---

## Hebrew / RTL

- `<html dir="rtl" lang="he">`; layout uses logical properties throughout
  (`ms/me`, `ps/pe`, `start/end`).
- **Time runs right to left.** On the departures board, today is pinned at the
  right edge and the future extends left. Recharts time axes use `reversed`.
- **Every LTR island is isolated.** Money, phone numbers, dates and Latin vendor
  names go through `<Money>`, `<Num>`, `<Phone>` in
  [`apps/web/src/components/shared/typography.tsx`](apps/web/src/components/shared/typography.tsx).
- **Currency.** Integer agorot on the wire. Shekels only at form edges
  (`toAgorot`) and in `<Money>`. Never pass agorot to `value=`.
- **All user-facing strings** are in
  [`packages/shared/src/i18n/he.ts`](packages/shared/src/i18n/he.ts). Zero
  hardcoded Hebrew in components.

---

## Deploying

Do not attempt to deploy from this repo until the account owner has:

1. A Neon Postgres project in `aws-eu-central-1` (pooled + direct URLs).
2. `VITE_API_URL` set as a **build** environment variable on Cloudflare.

Cookie pairing in production is `miftan.co.il` / `api.miftan.co.il` with
matching `COOKIE_PATH`. Same-origin `/api` proxy is required in development.
Full detail in `HOSTING.md` and `HANDOFF.md`.

---

## Structure

```
apps/api/          Fastify 5 + Drizzle + Postgres
apps/web/          Vite + React 18 + Tailwind (dev server on 5178)
packages/shared/   Domain + Zod contracts + Hebrew dictionary
packages/fixtures/ Seed data only
```

```
apps/web/src/
  app/          routes, three persona shells, role switcher
  personas/
    owner/      dashboard · properties · unit detail · tickets · maintenance · vendors
                crm · screening · inquiries · contracts · finance · market · reviews
                revenue · messages
    tenant/     home · report · tickets · renewal · documents · reviews
    seeker/     search+map · listing · queue · profile
  api/          typed client, hooks, query keys, auth
  components/
    ui/         primitives on Radix
    shared/     departure-track · map · protocol · revenue · status · typography
  data/         leftover fixture store (revenue, reset-demo)
```

## Where the product makes money

`/owner/revenue` is the model, and the **revenue lens** (₪ toggle in the top
bar) marks every earning point *inside the running product*. It is presentation,
not measurement — leave it on fixtures.

Three streams are modelled and **deliberately rejected**, with the reason shown:
paid queue-jumping, broker fees from seekers, and selling rental data.

## Screening and the law

`/owner/crm/filters` builds screening criteria only from objective,
apartment-related facts: income relative to rent, employment, guarantors,
move-in date, lease length, smoking, pets, occupancy vs. permitted, prior
landlord reference.

Protected characteristics are **not representable in the type system** —
`renter_profiles` has no field for family status, parenthood, age, gender,
nationality, country of origin, religion, ethnicity or sexual orientation.

Screening is a **soft sort, never a filter**. Flags are recomputed on every
read. The audit log records the rule as it stood at the decision.

See [DECISIONS.md](DECISIONS.md), [PRODUCT.md](PRODUCT.md) and [HANDOFF.md](HANDOFF.md).
