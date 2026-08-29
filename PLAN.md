# Miftach · build plan

Working document. We tick items off as we go. Two tracks — **CC** is Claude Code,
**YOU** is what only you can do (accounts, money, legal, decisions).

---

## Decisions made

| | |
|---|---|
| **Shape** | **Web first.** One responsive app, three personas, role from the account |
| **Backend** | Fastify + Postgres + Drizzle, our own API. No BaaS lock-in |
| **First vertical slice** | Maintenance ticket flow, end to end |
| **App stores** | Later and optional, via **Capacitor** — not React Native |

### Why web first

- **The prototype already is one.** RTL-correct, tested at 390px. React Native would throw that away and rebuild the map, the departures board and every layout.
- **Distribution is links, not installs.** A tenant with a leak gets sent a link. A seeker won't install anything before seeing a listing. Every viral path this product has is a URL.
- **No gatekeepers on the critical path.** No review, no rejection, no 14-day Google testing wall, no W-8BEN-E blocking launch.
- **No platform fee.** The ₪261/unit/year that would have been exposed to Apple's cut (subscription ₪144, contracts ₪40, verification ₪77) stays whole. ₪980/unit/year means ₪980.

### Why Capacitor later, not React Native

Web → React Native = two codebases, a real detour.
Web → Capacitor = **one codebase**, wrapped for the stores when they're worth it, with native push and camera. That's what makes this decision reversible rather than a fork.

### The one real cost

iOS web push only works if the user adds the site to their Home Screen. For this product **WhatsApp is the better channel anyway** — "האינסטלטור מגיע מחר ב־11:00" reaching an Israeli tenant on WhatsApp beats a push they'd have to opt into.

---

## Target shape

```
miftach/
  apps/
    api/        Fastify · Drizzle · Postgres · Zod
    web/        the current Vite app → the product
  packages/
    shared/     types · i18n · format · screening · API client
```

`packages/shared` is the point: `types/index.ts`, `i18n/he.ts`, `lib/format.ts`
and `lib/screening.ts` are platform-agnostic TypeScript today. The API and the
app both use them — one dictionary, one set of domain rules, one source of truth
for money and dates.

### Stack detail

| Concern | Choice | Why |
|---|---|---|
| ORM | **Drizzle** | Schema reads like the existing types; migrations are plain SQL you can review |
| Validation | **Zod**, shared | One schema validates the request *and* types the client |
| Data fetching | **TanStack Query** | Caching, retries and loading states without hand-rolling them |
| Auth | Email + password, phone OTP later | No Google/Facebook login means no Sign in with Apple obligation if we ever wrap |
| Files | **S3-compatible** (Cloudflare R2), presigned direct upload | Photos never pass through the API server |
| Notifications | **WhatsApp / SMS**, web push where supported | Meets Israeli users where they already are |
| Tests | **Vitest** | Same runner across api, web and shared |

---

## CC track

### Phase 0 — Workspace · ~1 session
- [ ] `git init` and commit the prototype as a return point
- [ ] npm workspaces monorepo; current app → `apps/web`
- [ ] Create `packages/shared`; move `types`, `i18n`, `lib/format`, `lib/screening`, `lib/rtl`
- [ ] Rewire imports; **the app must still build and run identically**
- [ ] Root scripts: `dev`, `dev:api`, `typecheck`, `test`

> Nothing user-visible changes in Phase 0. If the prototype looks different afterwards, I broke something.

### Phase 1 — Database · ~2 sessions
- [ ] Drizzle schema derived from `packages/shared/types`
- [ ] Migrations wired through `drizzle-kit`
- [ ] **Seed script that loads the existing demo data into real Postgres** — the 22 properties, 18 leases and 14 tickets become dev fixtures instead of throwaway mocks
- [ ] Decide and document: soft deletes, audit columns, **money as integer agorot**

### Phase 2 — API + auth · ~2 sessions
- [ ] Fastify app: Zod type provider, error envelope, request logging, health check
- [ ] Users, sessions, JWT access + refresh, argon2 password hashing
- [ ] **Role model** — one account can be owner *and* tenant *and* seeker; roles are per-property, not per-user
- [ ] `POST /auth/register|login|refresh|logout`, `GET /me`
- [ ] Typed API client in `packages/shared`

### Phase 3 — The privacy boundary · ~1 session
Its own phase because it is the product.
- [ ] One authorization layer; every read passes through a single policy module
- [ ] Enforce: **a seeker can never read tenant identity** — not hidden in the UI, unreadable at the API
- [ ] Enforce: the availability signal is derived server-side; raw `renewal_intent` never leaves owner/tenant scope
- [ ] Tests asserting a seeker token gets 403 or a redacted field on every tenant attribute

### Phase 4 — Ticket flow API · ~2 sessions
- [ ] `properties`, `leases`, `tickets`, `vendors`, `expenses` endpoints
- [ ] Server-side **state machine** for ticket status — the client cannot skip steps
- [ ] Presigned upload for photos and receipts
- [ ] Receipt → expense auto-creation, in one transaction
- [ ] Integration tests over the whole flow

### Phase 5 — Wire the app to real data · ~3 sessions
- [ ] Replace zustand mock actions with TanStack Query against the API
- [ ] Real login; **delete the persona switcher** — role comes from the account
- [ ] Loading, error and empty states against real latency
- [ ] Every screen keeps looking as it does now

### Phase 6 — Mobile-grade web · ~2 sessions
- [ ] Polish at 390px for the flows that actually happen on a phone: report a fault, my tickets, search, listing
- [ ] **PWA**: manifest, service worker, installable, "add to home screen" prompt for tenants
- [ ] Camera capture through the file input — opens the native camera on both platforms
- [ ] Offline-tolerant submit; a fault gets reported in a stairwell with one bar

### Phase 7 — Notifications · ~2 sessions
- [ ] WhatsApp / SMS for the events that matter: ticket assigned, visit scheduled, inquiry answered, rent due
- [ ] Email fallback and a digest for owners
- [ ] Web push where it works (Android, installed iOS)

### Phase 8 — Pilot readiness · ~2 sessions
- [ ] Onboarding: a landlord adds their first property and invites a tenant by link
- [ ] Sentry, basic analytics, database backups, uptime monitoring
- [ ] Seed a real portfolio with a real landlord

### Phase 9 — App stores · optional, later
- [ ] Capacitor wrap of `apps/web`
- [ ] Native push and camera plugins
- [ ] Store assets, screenshots, submission

---

## YOUR track

Ordered by lead time. The store items are no longer on the critical path.

### Start now
- [ ] **Domain + email** (`miftach.co.il` or similar). This is now the launch dependency — the product lives at a URL
- [ ] **Legal entity** — personal or חברה בע״מ? Contracts, payouts and invoicing all hang off it
- [ ] **WhatsApp Business API** — needs Meta business verification, which takes real calendar time. Start it early; it gates Phase 7
- [ ] **Lawyer, two questions:**
  1. **Insurance affiliate** — commission on insurance placement in Israel generally needs a licence from רשות שוק ההון. May require a licensed partner between you and the insurer. Ask before it goes in a deck
  2. **Privacy** — חוק הגנת הפרטיות was amended (תיקון 13); get current advice. You'll hold income declarations, lease documents and tenant identities

### Before Phase 5
- [ ] **Hosting accounts** — I'll name the exact three when we get there (API host, Postgres, R2). Roughly $20–40/month at this stage
- [ ] **Privacy policy + terms** — needed for the live site, not just the stores
- [ ] **Pricing decision** — is it ₪12/unit/month, and is there a floor for small landlords?

### Before Phase 8
- [ ] **Pilot list** — the 5–10 landlords who will actually use this, and their tenants. Real portfolios beat more features
- [ ] **Support process** — who answers when a tenant can't log in at 21:00

### Deferred (finish, but nothing waits on it)
- [ ] Bank + tax details in both consoles; Apple needs a **W-8BEN-E** from a non-US entity. Slow, so finish it while it's free to wait
- [ ] App name check and reservation in both stores
- [ ] If your Play account is **personal** and post-Nov-2023: Google's 20-testers-for-14-days rule. Only bites at Phase 9

---

## Rough calendar

Phases 0–5 give you a **real product on a real backend**. Phases 6–8 make it good on a phone and ready for actual users.

Roughly **2–3 months to a pilot with real landlords and real tenants**. Speed depends more on your track than mine — legal, WhatsApp verification and finding the pilot are calendar time nobody can compress.

---

## Rules for this build

1. **Nothing gets faked twice.** Where the prototype mocks something we either build it properly or delete it. No mock survives into `apps/api`.
2. **The privacy boundary is enforced server-side**, tested, and never trusted to the UI.
3. **Money is integer agorot.** Never a float, anywhere.
4. **All strings stay in `packages/shared/i18n`.** It's the Arabic/English/Russian seam and it already holds.
5. **Every phase ends with the app still running.** No long broken periods.
