# Handoff — wiring the remaining screens

You are picking up a Hebrew RTL rental-management product called **מפתן / Miftan**.
The backend is finished and tested; most of the front end still reads a
prototype fixture store instead of the API. Your job is to finish that cutover.

Read this whole file before editing anything. Then read `PRODUCT.md`,
`DESIGN.md` and `DECISIONS.md` — they are short and they explain *why* the code
looks the way it does, which matters because several things that look like
mistakes are deliberate.

---

## 1. Orientation

### Repository

```
miftan/
  apps/api/          Fastify 5 + Drizzle + Postgres. Complete. 186 tests passing.
  apps/web/          Vite + React 18 + Tailwind. This is where your work is.
  packages/shared/   Domain logic + Zod schemas, imported by BOTH sides.
  packages/fixtures/ Seed data only. Not a runtime dependency of the web app.
```

### Running it

```bash
# 1. Postgres must be up (Postgres.app). Then, once:
cd apps/api && npm run db:reset && npm run db:migrate && npm run db:seed

# 2. API — leave running
cd apps/api && npm run dev          # http://127.0.0.1:4000

# 3. Web — leave running, separate terminal
npm run dev -w @miftan/web          # http://localhost:5178
```

The web dev server proxies `/api` → `127.0.0.1:4000`, so the app and API are
same-origin. **Do not change that** — the refresh cookie is `sameSite=lax` and
a cross-origin setup silently breaks session persistence on reload.

### Signing in

Password for every seeded account: `miftan-dev-2026`

| Account | Email | Holds |
|---|---|---|
| Owner | `ran@almog-nadlan.co.il` | 22 properties |
| Tenant | `michal.stern@gmail.com` | 1 lease |
| Seeker | `tal.aviram@gmail.com` | queue rows only |
| **All three** | `dana@miftan-demo.co.il` | owns 3, rents 1, queues for 2 |

**Test with `dana@miftan-demo.co.il`.** It is the only account that holds all
three relationships, and it is how you catch the bug class described in §3.1.

### Verifying your work

```bash
npm run typecheck      # must be clean
npm run build          # must be clean
npm run test           # 186 API + 7 shared, must stay green
```

Then open the screen in a browser, signed in as Dana, and confirm the numbers
match what the API returns. `curl` the endpoint and compare. Do not assume.

---

## 2. What is already done

**Do not redo these. They are wired and verified.**

| File | Status |
|---|---|
| `personas/owner/properties.tsx` | on the API |
| `personas/tenant/home.tsx` | on the API |
| `personas/seeker/queue.tsx` | on the API |
| `personas/owner/seasonal.tsx` | on the API |
| `app/shell.tsx` (rail badges) | on the API |
| `api/hooks.ts` | **complete** — a hook exists for every endpoint |
| `api/query.ts` | **complete** — a query key exists for everything |

`apps/web/src/api/hooks.ts` is the file you will use constantly. Every read and
write already has a hook with invalidation wired. **Add to it rather than
calling `api.request` from a component.**

---

## 3. Rules you must not break

These are not style preferences. Each one has a test, a bug report, or a legal
reason behind it.

### 3.1 A response contains rows in *different scopes*

`GET /properties`, `GET /leads`, `GET /inquiries` and `GET /tickets` return
every row you have a relationship to, **each projected for the relationship you
hold**. An account that owns flats and rents one gets `scope: 'owner'` rows and
a `scope: 'tenant'` row in the same array.

So **always filter by scope for the screen you are on**:

```ts
// The portfolio page shows units you OWN, not the flat you rent.
const owned = properties.filter((p) => p.scope === 'owner');

// The tenant's home is the flat you RENT.
const home = properties.find((p) => p.scope === 'tenant');
```

This has already caused one real bug: the portfolio page listed the flat Dana
*rents* under a heading reading "all units in your ownership". If you skip the
filter it will look fine on every single-role account and be wrong on Dana's.

### 3.2 Money is agorot on the wire, shekels on screen

Every money field from the API ends in `Agorot` and is an integer. Never do
arithmetic to convert it in a component.

```tsx
<Money agorot={lease.monthlyRentAgorot} board />   // correct
<Money value={lease.monthlyRentAgorot} />          // WRONG — renders ₪1,040,000
```

`Money` takes **either** `value` (shekels) **or** `agorot`. Two named props,
because passing 1040000 where 10400 was meant renders as a plausible-looking
₪1,040,000.

For a bare string, `formatAgorot(n)` from `@miftan/shared`.

### 3.3 Never read another role's private field

The seeker-facing path must never touch a tenant's `renewalIntent`. It goes
through `deriveAvailability()` in `@miftan/shared`, which is the single place
private intent becomes a public signal. The API already does this; your job is
simply not to invent a second path.

Likewise: a seeker never sees another applicant's name, and a tenant never sees
who is asking about their flat. The API enforces this by returning different
*shapes*, so if a field is absent from the type, that is deliberate — do not add
it to the schema to make a screen easier.

### 3.4 No hardcoded Hebrew in components

Every string comes from `t` in `packages/shared/src/i18n/he.ts`. If you need a
new string, add it there first. There are zero exceptions in the codebase today
and it should stay that way.

### 3.5 RTL

`dir="rtl"` is the document default. Use logical properties (`ms-`, `me-`,
`ps-`, `pe-`, `inset-inline-start`), never `ml-`/`mr-`/`left`/`right`.

Any LTR island — money, phone numbers, dates, meter readings, emails — must go
through the wrappers in `components/shared/typography.tsx` (`<Money>`, `<Num>`,
`<Phone>`). They apply `dir="ltr"` + `unicode-bidi: isolate`. Without them,
Hebrew text around a number scrambles.

### 3.6 Loading, error and empty — all three

Every wired screen needs all three states. Use the existing components:

```tsx
const { data = [], isLoading, isError, refetch } = useThing();

if (isError) return <ErrorState onRetry={() => void refetch()} />;
if (isLoading) return <ListSkeleton rows={6} />;
if (data.length === 0) return <EmptyState icon={X} title={t...} hint={t...} />;
```

`ErrorState` is at `components/shared/error-state.tsx`. Skeletons are at
`components/shared/skeleton.tsx`. Do not invent new ones.

### 3.7 Motion

Read the tokens in `apps/web/src/styles/app.css`. Summary:

- Press feedback: add the `press` or `press-sm` class. Never write your own.
- Never `ease-in` on UI. Use `var(--ease-out)`.
- Durations: `var(--dur-press)` 140ms, `--dur-menu` 200ms, `--dur-sheet` 280ms.
- Exit is ~65% of enter.
- Amber (`--color-signal`) means "a date exists". **It never appears on a
  button.** Primary actions are ink-filled.

For any button that fires a mutation, use the `loading` prop:

```tsx
<Button loading={mutation.isPending} onClick={...}>{t.thing.save}</Button>
```

---

## 4. The work, screen by screen

Do them in this order. Each is independent; commit after each one.

Pattern for every screen:

1. Read the file. Note every `s.something` it pulls from the store.
2. Find the matching hook in `api/hooks.ts`.
3. `curl` the endpoint as Dana and look at the actual JSON. Field names differ
   from the fixtures — the API is camelCase, the fixtures are snake_case.
4. Replace the store selectors with hooks.
5. Add the three states from §3.6.
6. Filter by scope per §3.1.
7. `npm run typecheck` → open the screen as Dana → compare against the curl.

To curl as Dana:

```bash
TOK=$(curl -s -X POST http://127.0.0.1:4000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"dana@miftan-demo.co.il","password":"miftan-dev-2026"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

curl -s http://127.0.0.1:4000/leads -H "authorization: Bearer $TOK" | python3 -m json.tool
```

---

### Batch A — endpoints exist, straightforward

#### A1. `personas/tenant/documents.tsx` (149 lines)

- Hooks: `useProperties()` → take the `scope: 'tenant'` row for the lease.
- **Blocked field:** rent payment history has no endpoint. See §5, gap 1.
  For now, render the lease document and receipts from tickets
  (`useTickets()` → those with `receiptFile`), and leave the payments tab
  showing an `EmptyState` until gap 1 is closed.

#### A2. `personas/tenant/renewal.tsx` (312 lines)

- Hooks: `useProperties()` (tenant row → `lease.renewalIntent`,
  `lease.renewalAskedAt`), `useInquiries()`, `useInquiryAction()`.
- The tenant answers with
  `inquiryAction.mutate({ id, action: 'answer', body: { answer, note } })`
  where `answer` is `'extend' | 'leave' | 'undecided' | 'too_early'`.
- Keep the **"מה מפתן מפרסם"** panel. It shows the tenant exactly what a seeker
  sees about their flat, and it is the thing that makes answering honestly safe.
  Its value comes from `deriveAvailability()`, not from the raw intent.
- Filter inquiries to `scope === 'tenant'`.

#### A3. `personas/tenant/tickets.tsx` (275 lines) — partially wired

- Already uses `useTickets()`. Remove the remaining store lookups for property
  names: `TicketView` carries `propertyLabel` already.
- Use `useConfirmSlot()` and `useUploadReceipt()` — both already exist.

#### A4. `personas/tenant/report.tsx` (370 lines) — partially wired

- Already uses `useCreateTicket()`. Remove the store lookup for the property;
  take it from `useProperties()` → `scope: 'tenant'`.

#### A5. `personas/owner/messages.tsx` (229 lines)

- Hooks: `useThreads()`, `useThread(id)`, `usePostThreadMessage()`,
  `useMarkThreadRead()`, `useStartThread()`.
- `useThreads()` returns `{ threads, totalUnread }` where each thread has **no
  `messages`** — that is deliberate, a mailbox list does not need every letter
  opened. Load one thread with `useThread(id)` when it is selected.
- `thread.counterpartyName` is already "the other person" from *your* side. Do
  not compute it.
- Each message has `mine: boolean`. Use that to pick a side, not the role.

#### A6. `personas/owner/screening.tsx` (274 lines)

- Hooks: `useScreeningPresets()`, `useUpdatePreset()`, `useActivatePreset()`,
  `useScreeningAudit()`.
- Criteria shape: `{ id, enabled, weight: 1|2|3, value?: number|boolean }`.
- The audit list is append-only and must stay read-only in the UI. Its whole
  purpose is showing what a rule *was* at the time, so never re-render historic
  flags against the current preset.

#### A7. `personas/owner/inquiries.tsx` (388 lines)

- Hooks: `useInquiries()`, `useInquiryAction()`.
- Filter to `scope === 'owner'`.
- The chain is: `ask-tenant` → (tenant answers) → `reply` or `decline`.
  Owner-visible only: `tenantAnswer`, `tenantAnswerNote`. Show them — the owner
  is entitled to them. **They must never be forwarded into the `reply` body.**
  The reply is the owner's own words; the seeker never sees the tenant's.
- `reply` body: `{ reply: string, availableFrom?: string, confidence?: 'confirmed'|'likely'|'unknown' }`.

#### A8. `personas/owner/crm.tsx` (529 lines)

- Hooks: `useLeads()`, `useSetLeadStage()`, `useScreeningPresets()`.
- Filter to `scope === 'owner'`.
- An owner lead already carries `seeker` (contact), `screening` (snapshot),
  `flags` (recomputed on every read) and `score`. **Do not recompute the score
  in the component** — that is the one place two implementations would diverge.
- Stages: `new | screening | viewing_scheduled | viewed | offer | signed | rejected`.
- Leads are **sorted, never filtered**. A failed criterion lowers the rank and
  shows a reason; it must never remove someone from the board.

#### A9. `personas/owner/contracts.tsx` (453 lines)

- Hooks: `useContractScans()`, `useScanContract()`, `useCommitScan()`.
- **New:** add hooks for the template library — `GET /contract-templates`,
  `POST /contract-templates`, `DELETE /contract-templates/:id`,
  `POST /contract-templates/:id/render`. Schemas are in
  `packages/shared/src/api/contract-templates.ts`.
- The "generate" tab should list templates, let the owner pick a lease to
  pre-fill from, show `missing` fields as required inputs, and render the text.
- **The disclaimer must be visible on the document**, not in a tooltip. It is
  already inside the rendered `text`; do not strip it.
- Editing a built-in POSTs with `basedOn: '<builtin-id>'`, which clones it.

#### A10. `personas/owner/vendors.tsx` (295 lines)

- Hook: `useVendors()`. Straightforward.
- Keep the affiliate disclosure (`partnerDisclosure`) visible on any vendor with
  `isNetworkPartner`. That is a commercial-honesty commitment, not decoration.

---

### Batch B — need composition or a new endpoint

#### B1. `personas/owner/dashboard.tsx` (406 lines)

Compose from existing hooks: `useProperties()`, `useTickets()`, `useLeads()`,
`useInquiries()`, `useSeasonal()`.

- Collection rate needs rent payments → **gap 1**. Until then, hide that tile
  rather than showing a fixture number. A dashboard that mixes live and fake
  figures is worse than one that admits a gap.
- The departures board rows come from `properties.filter(p => p.scope === 'owner')`
  with `availability.date`.
- `outstandingExpectedSaving` comes straight from `useSeasonal()`. Do not
  recompute.

#### B2. `personas/owner/unit-detail.tsx` (720 lines)

Largest file. Hooks: `useProperty(id)`, `useTickets({ propertyId })`,
`useLeads(propertyId)`, `useExpenses(propertyId)`, `useProtocols()`,
`useViewings(propertyId)`.

Consider splitting into tab components while you are in there. It is 720 lines
because it is five screens wearing a trenchcoat.

#### B3. `personas/seeker/search.tsx` (530 lines)

- Hook: `useRunSearch()` — a **mutation, not a query**, deliberately: it records
  a search event, and a query would refire on mount and inflate the demand data
  with searches nobody performed. Call it on submit and on filter change
  (debounced ~400ms), not on render.
- Filter shape is `searchFiltersSchema` in `packages/shared/src/api/search.ts`.
  It is much wider than the current UI: district, city, neighbourhood, min/max
  rooms, min/max sqm, min/max price, min/max floor, amenities, availableFrom,
  availableBy, includeOccupied, confirmedOnly, minLeaseMonths, sort.
- **Add the missing filters to the UI** — that was an explicit request. Cities
  and districts come from `CITIES` / `citiesByDistrict()` in
  `packages/shared/src/catalog/regions.ts` (all Israel, six CBS districts).
- `includeOccupied` defaults **true**. Occupied-with-a-date is the product's
  entire argument; do not make it opt-in.
- Show `totalIgnoringDate` when `total` is 0 — "nothing in October, four in
  November" is far more useful than "no results".

#### B4. `personas/seeker/listing.tsx` (536 lines)

- Hooks: `useProperty(id)` (public scope), `useLeads()`, `useReserveQueue()`,
  `useLeaveQueue()`, `useAskAvailability()`, `useViewings(propertyId)`,
  `useViewingAction()`.
- **Add the viewing booking UI** — it has an endpoint and no screen yet.
  `useViewings()` returns `{ slots, eligible, ineligibleReason }`. When
  `eligible` is false, show `ineligibleReason` — a refusal with no reason is the
  worst version of that screen.
- Never show who holds the other slots. `SeekerSlot` has `taken` and `mine`
  only, by design.

#### B5. `personas/seeker/profile.tsx` (271 lines)

**Blocked.** The renter profile has no endpoint. See §5, gap 2.

#### B6. `personas/owner/finance.tsx` (367 lines)

**Partly blocked.** `useExpenses()` exists; rent payments do not. See gap 1.

#### B7. `personas/owner/revenue.tsx` + `components/shared/revenue.tsx`

**Leave on fixtures.** This is the investor-facing revenue model — a
presentation surface built from assumptions, not from user data. Wiring it to an
API would imply the numbers are measured when they are modelled. Do not touch it
unless asked.

#### B8. `components/shared/protocol.tsx` (348 lines)

- Hooks: `useProtocols()`, `useStartProtocol()`, `useUpdateProtocolEntry()`,
  `useCompleteProtocol()`, `useProtocolComparison(propertyId)`.
- Checklist items come from `protocolItems` in `@miftan/shared` — they are
  **domain data, not fixtures**, so importing them is correct. Do not try to
  fetch them.
- Both parties can write entries. Do not gate editing on being the owner.
  Only *completing* is owner-only.
- A completed run is locked. Respect `completedAt`.

---

## 5. Missing endpoints you may need to build

These are genuine gaps. Build them in `apps/api` following the existing
patterns, **with tests**, before wiring the screens that need them.

### Gap 1 — rent payments

Blocks: owner dashboard collection rate, owner finance, tenant payment history.

```
GET /rent-payments?propertyId=&from=&to=
```

Table exists: `rent_payments` (`month` as `yyyy-MM`, `dueAgorot`, `paidAgorot`,
`paidAt`, `method`). Needs an owner projection (all their units) and a tenant
projection (their own lease only). Follow `apps/api/src/routes/directory.ts`
for the shape and `policy/properties.ts` for the scoping.

### Gap 2 — renter profile

Blocks: seeker profile screen.

```
GET   /me/renter-profile
PATCH /me/renter-profile
```

Table exists: `renter_profiles`. Note `complete: boolean` — `POST /leads`
refuses an incomplete profile, so the screen must show what is still missing.

### Gap 3 — property create / update

There is no way to add a property through the API. `PUT /properties/:id/photos`
exists; nothing else does. Needed eventually for a real owner onboarding.

---

## 6. Deployment — currently blocked

Do not attempt to deploy. It is waiting on two things the account owner must
provide, and neither is a code problem.

**Ready:** Fly app `miftan` exists in `fra`, `fly.toml` and `Dockerfile` are
committed and the image builds (77 MB). JWT and all five R2 secrets are staged.
R2 bucket `miftan-uploads` is live with CORS set and verified end to end.

**Blocked on:**

1. **A Neon Postgres project** (region `aws-eu-central-1`). Two connection
   strings are needed: the **pooled** one (with `-pooler` in the host) for the
   running app, and the **direct** one for migrations and seeding.
   `apps/api/src/db/client.ts` already detects `-pooler` and disables prepared
   statements — without that the app works until it starts throwing
   `prepared statement "s1" does not exist` under concurrency.
2. **The Cloudflare project URL**, and `VITE_API_URL` set as a *build*
   environment variable there. It is baked in at build time, so it needs a
   rebuild to take effect. Without it the deployed app calls `/api` on its own
   origin, gets `index.html` back with a 200, and shows *אין חיבור לשרת*.

Full detail in `HOSTING.md`.

---

## 7. Things that look like bugs and are not

- **`packages/shared` has `types: []` in its tsconfig.** Deliberate — nothing in
  that package may reach for a Node global. Tests are typechecked separately via
  `tsconfig.test.json`.
- **`no-platform-code.test.ts` greps the source for `localStorage`, `document`
  etc.** It is the real purity guard; `tsc` cannot catch this because the DOM lib
  is included so the API client can use `fetch`.
- **Access token lives in memory, never `localStorage`.** Surviving a reload is
  the refresh cookie's job.
- **`db:seed` is not idempotent.** Run `db:reset && db:migrate && db:seed`.
- **Screening flags are recomputed on every read, never stored.** A stored flag
  would be a claim about a rule that no longer exists.
- **The contract "AI scan" is a pattern extractor, not an LLM.** It sits behind
  the `ContractExtractor` interface in `apps/api/src/extract/`. An LLM can drop
  in behind the same interface. Do not present it as AI in the UI beyond what
  the existing copy says.

---

## 8. Commit style

Look at `git log`. Messages explain *why*, in prose, not bullet lists of what
changed. Match that. Include what you found and what you decided against.

Run before every commit:

```bash
npm run typecheck && npm run build && npm run test
```

Never commit a secret. `.env` is gitignored; **the repository is public**.
