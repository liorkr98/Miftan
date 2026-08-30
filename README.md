# מפתן · Miftan

A clickable, front-end-only prototype of an Israeli rental-management product.
Hebrew UI, RTL, no backend, no auth, no network calls.

One landlord runs their whole operation — maintenance, dispatch, receipts,
leases, renewals, rent changes and a lead pipeline — while apartment seekers
browse **every** apartment the landlord owns, including occupied ones, see when
each frees up, and get in line months in advance.

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

```bash
npm run build
```

```bash
npx tsc --noEmit
```

Both are clean.

## Renaming the app

`APP_NAME` in [`src/i18n/he.ts`](src/i18n/he.ts) is the single source. Change it
there and the top bar, page title and copy follow.

---

## The three personas

A segmented control in the top bar switches the entire app shell, navigation and
route set. Each persona is deep-linkable:

| Persona | Routes | Shape |
|---|---|---|
| בעל דירות | `/owner/*` | Side rail, 7 sections, dense. A workstation. |
| דייר | `/tenant/*` | No rail, 5 large destinations. A consumer app. |
| מחפש דירה | `/search/*` | No chrome in the way of the map. A browser. |

Switching persona routes to that persona's root rather than mapping to an
"equivalent" screen — there is no equivalence between a portfolio board and a
search map, and pretending otherwise would misrepresent the product.

Opening a deep link directly (e.g. `/tenant/renewal`) sets the persona to match.

---

## The five flows that must work end to end

**Maintenance.** Tenant opens a ticket with a photo → owner approves → owner
picks a vendor from the directory (filtered to the right trade and service area)
→ vendor gets a slot from the tenant's stated availability → tenant confirms
they'll be home → receipt is uploaded → **an expense is auto-created against the
unit** and the ticket closes.

**Queue.** Seeker filters by `זמין החל מ־` (a date, not a boolean) → opens an
occupied apartment with a known free-date → `שריין מקום בתור` → the lead appears
in the owner's CRM, scored against the active screening preset, with an audit
entry written. Leaving the queue moves everyone behind you up.

**Availability inquiry.** This is the one that makes undecided apartments
useful. A seeker opens a unit whose tenant hasn't decided → `שאל מתי הדירה
תתפנה` → the request lands on the owner's board → owner forwards **one
question** to the tenant → the tenant answers (`מאריך` / `עוזב` / `לא בטוח` /
`מוקדם מדי להחליט`, plus an optional private note) → the owner gets a
pre-written reply to edit and sends it → the seeker sees the answer and the
unit now carries a **projected** date.

The seeker and the tenant never touch. The tenant sees a question about their
own lease, never a person; the seeker sees a date, never an identity. That rule
is enforced in `availabilityKind()`, which is never given the tenant.

**Contract intake.** Pick a unit → upload → staged pipeline (upload → read →
extract → your review) → every field comes back with a confidence score and a
source hint, two of them deliberately low → edit anything → commit writes to
the lease. Editing a field sets its confidence to 1: a human-confirmed field.

**Preventive maintenance.** Eight seasonal templates fan out across eligible
units (a gutters task only lands on units with a balcony). Scheduling opens a
real ticket, so preventive work lives in the same board as reactive work.

All five were walked click-by-click in a browser before this was called done.

---

## What's mocked, and where a real backend attaches

| Area | Now | Where it attaches |
|---|---|---|
| **Persistence** | Zustand store in memory, hydrated from `src/data/seed/*`. A hard page reload restores seed state. | Swap `src/data/store.ts` actions for API calls; `src/data/reset.ts` becomes the test fixture loader. |
| **Auth** | None. `currentTenantId` / `currentSeekerId` are fixed demo identities in the store. | Session provider above the router; the persona switcher becomes a role claim, not a control. |
| **Photo & receipt uploads** | `picsum.photos` seeded URLs; "upload" appends a URL. | Object storage + signed URLs. `Ticket.photos` and `Receipt.file` already hold URLs, so the shape doesn't change. |
| **Documents** | Lease PDF and receipts are placeholders. | Document service; `tenant/documents.tsx` renders whatever URLs it's given. |
| **Contract generation / e-signature** | Out of scope. | Would slot between `LeadStage.offer` and `signed`. |
| **Payments & rent collection** | `RentPayment` rows are seeded, nothing charges anything. | Payment provider; `standing_order` / `post_dated_checks` are already modelled. |
| **Notifications** | Toasts only. | Push/SMS on `assignVendor`, `sendRenewalProposal`, and any `available_from` change on a watched unit. |
| **Yad2 / Madlan ingestion** | None. Comparables come from the owner's own portfolio. | Would feed `rentComparison()` in `src/data/selectors.ts`. |
| **Contract OCR / extraction** | `advanceContractScan()` returns plausible values derived from the picked unit, on a timer, with two fields deliberately low-confidence. | Document AI endpoint returning `ExtractedField[]`. The shape, the confidence scores and the review-before-commit step are already the real design. |
| **Protocol signatures** | `signed: true` on complete. | E-signature provider; both parties sign the same `ProtocolRun`. |
| **Affiliate fulfilment** | `requestOffer()` records intent locally. Provider names are invented placeholders. | Partner APIs / lead handoff. `RevenueStream.unit_revenue` is where real rate cards attach. |
| **Map** | OpenStreetMap raster tiles, no key, no billing. No clustering. | Swap the `TileLayer` URL; add clustering when pin density warrants it. |

`resetDemo()` (top bar → אפס הדגמה) restores the full seed state at any time.

---

## Hebrew / RTL

- `<html dir="rtl" lang="he">`; layout uses logical properties throughout
  (`ms/me`, `ps/pe`, `start/end`). The only physical values are transforms in
  the departures board, documented in [`src/lib/rtl.ts`](src/lib/rtl.ts).
- **Time runs right to left.** On the departures board, today is pinned at the
  right edge and the future extends left. Recharts time axes use `reversed` for
  the same reason.
- **Every LTR island is isolated.** Money, phone numbers, dates and Latin vendor
  names go through `<Money>`, `<Num>`, `<Phone>` or `<Ltr>` in
  [`src/components/shared/typography.tsx`](src/components/shared/typography.tsx),
  which wrap them in `dir="ltr"` + `unicode-bidi: isolate`.
- **Currency.** `Intl.NumberFormat('he-IL')` for the digits, `₪` placed by us in
  the leading position. `style: 'currency'` on `he-IL` emits two embedded RLM
  marks that fight the LTR isolate and put the sign on the wrong side.
- **All user-facing strings** are in [`src/i18n/he.ts`](src/i18n/he.ts) as one
  flat typed dictionary — including relative times and units. Zero hardcoded
  Hebrew outside it. That file is the seam for Arabic / English / Russian.
- Tested at 390px. The 18-month Gantt does not shrink on mobile; it re-renders
  as a month-grouped list carrying the same data.

---

## Structure

```
src/
  app/          routes, three persona shells, persona switcher
  personas/
    owner/      dashboard · properties · unit detail · tickets · maintenance · vendors
                crm · screening · inquiries · contracts · finance · revenue · messages
    tenant/     home · report · tickets · renewal · documents
    seeker/     search+map · listing · queue · profile
  components/
    ui/         shadcn-idiom primitives on Radix (button, badge, card, dialog, tabs, field)
    shared/     departure-track · map · protocol · revenue · status · typography
                empty-state · skeleton · charts · meter · toaster
  data/         seed/*.ts · store.ts (zustand) · reset.ts · selectors.ts
  i18n/         he.ts
  types/        index.ts
  lib/          format.ts (₪, dates, phones) · rtl.ts · screening.ts · utils.ts
```

## Where the product makes money

`/owner/revenue` is the model, and the **revenue lens** (₪ toggle in the top
bar) marks every earning point *inside the running product* — turn it on and
walk the app rather than describing it on a slide.

Eleven active streams, modelled as data in `src/data/seed/revenue.ts`, each
naming the exact surface it fires on: vendor commission, seasonal maintenance
packages, owner subscription, building insurance, contents insurance, painting,
end-of-lease cleaning, upholstery cleaning, moving, digital contracts, applicant
verification. Totals are computed from the live portfolio size — nothing is
hardcoded — and the portfolio field is editable so you can answer "and at 500
units?" on the spot.

Three streams are modelled and **deliberately rejected**, with the reason shown:
paid queue-jumping, broker fees from seekers, and selling rental data. That
section exists because it's the second question a serious partner asks.

Provider names in the affiliate offers are invented placeholders — no real
insurer or service company is implied.

## Screening and the law

`/owner/crm/filters` builds screening criteria only from objective,
apartment-related facts: income relative to rent, employment, guarantors,
move-in date, lease length, smoking, pets, occupancy vs. permitted, prior
landlord reference.

Protected characteristics are **not representable in the type system** —
`ScreeningProfile` in [`src/types/index.ts`](src/types/index.ts) has no field for
family status, parenthood, age, gender, nationality, country of origin, religion,
ethnicity or sexual orientation, so no preset can be built on them.

Screening is a **soft sort, never a filter**: a lead that misses a criterion
ranks lower and is flagged with the reason, and always stays in the list. Every
ranking decision writes a line to an exportable audit log.

See [DECISIONS.md](DECISIONS.md) for the design reasoning.
