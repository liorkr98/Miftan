# Design decisions · מפתח

## The scene sentence

> A 54-year-old landlord stands in a Florentin stairwell at 20:40, phone held at
> arm's length because he's long-sighted, streetlight orange through the window,
> deciding whether to approve a ₪900 plumber call-out before he gets in the car.
> Two hours later a 26-year-old on a couch in Givatayim is looking for an
> apartment for *October*, not for tonight.

That forces a **light theme**, high contrast and large numerals. Half the usage
is outdoors on a dimmed screen in Israeli daylight. Landlords are not dark-mode
developers. Dark is reserved for the app chrome.

## The concept: לוח יציאות, a departures board

The product's whole thesis is a claim about **time**: every apartment has a
date, occupied ones included. Yad2 shows you flights already boarding; Miftach
shows the schedule. So the organising metaphor is a departures board — a list of
things leaving at known future times that you can get in line for.

That buys three things at once: the signature element, the status palette, and
the reason numerals get their own typeface. It appears in exactly one component
and one colour rule. Everything else is quiet product UI.

## Palette — Restrained, one Committed element

Composed in OKLCH around a cobalt seed, then re-derived warm. Contrast ratios
below are measured, not estimated.

| Role | Hebrew | OKLCH | Hex | Job |
|---|---|---|---|---|
| `--ink` | פחם | `0.245 0.018 52` | `#281E19` | chrome, headings, body, primary buttons — **16.3:1** on white |
| `--bg` | לובן | `1 0 0` | `#FFFFFF` | canvas, pure |
| `--surface` | גיליון | `0.975 0.005 66` | `#F9F5F2` | panels, rail |
| `--signal` | ענבר | `0.785 0.145 78` | `#EBAC39` | **"there is a date"** — ink-on-amber **8.1:1** |
| `--live` | תכלת | `0.535 0.088 250` | `#4674A2` | occupied · in progress · settled — white-on **4.9:1** |
| `--alert` | אזעקה | `0.545 0.185 30` | `#C53324` | urgent · overdue — white-on **5.4:1** |

Derived: `--open` `#2E8258` (פנוי עכשיו, 4.7:1), `--muted` `#726963` (5.3:1 —
deliberately not a light gray), `--line` `#E6E1DC`, `--signal-deep` `#844C00`
for amber used as text (7.0:1).

### The rule that makes it a system

**Amber never appears on a button.** Amber means *a date exists*. It appears on
timeline bars, availability chips and map pin fills — nowhere else. Primary
actions are ink-filled. This keeps the brand colour fully semantic and stops the
usual accent-everywhere mush.

### The thesis, rendered in colour

`מתפנה ביולי` gets the loudest colour in the system — louder than `פנוי עכשיו`.
An occupied apartment with a known date is the product's reason to exist, so it
is visually first-class and vacancy is calm green. On the map, dated pins are
amber-filled and carry the date; undated ones recede to ink at 82% opacity.
That inversion is the design argument.

### What the warm re-derivation bought

The first pass was cold slate. Moving to warm neutral chrome made `--live` the
**only** cool colour in the system, so the semantics fall out for free:

- **Warm** (amber, red) = upcoming, or needs a person.
- **Cool** (blue) = settled, nothing to do.
- **Green** = open now.

The cold version couldn't make that distinction because everything was cool.

## Typography — two faces on a real contrast axis

**Assistant** (200–800) for everything. **IBM Plex Mono** (400–600) for numerals
in board and table contexts only.

**Hebrew has no uppercase.** The whole small-caps / tracked-eyebrow hierarchy
toolkit does not exist, so hierarchy comes from weight, size and colour alone —
which means weight range is the decisive property. Assistant is the humanist
Israeli face and is the single biggest warmth lever available; Heebo (the first
choice) is Roboto-derived and reads technical; Rubik's rounding reads consumer,
wrong for an operations tool.

The second face is functional, not decorative. Numerals here are columnar data
(₪ rents, m², dates, queue positions, the month scale) *and* LTR islands inside
RTL text that need visual isolation anyway. A distinct mono makes the bidi
isolation legible instead of accidental.

Mono is restricted to board scales, table columns and IDs. Inline ₪ amounts
inside prose stay in Assistant with `font-variant-numeric: tabular-nums`, so the
UI never reads as debug output.

Scale: fixed rem, ratio ~1.2 — `12 · 13 · 14 · 16 · 19 · 23 · 28 · 33`. Base 16,
UI labels 14, floor 12. Hebrew needs more optical size than Latin at the same px.

## Layout — one shell, three genuinely different topologies

Personas differ by **structure, not hue**. Recolouring per persona would collide
with the semantic status palette, which is the colour system's actual job.
Instead the navigation visibly rewrites itself and each persona has a different
navigational shape: owner = rail + 7 dense sections; tenant = no rail, 5 large
destinations; seeker = no rail at all, filter bar plus a full-bleed map.

The chrome is a dark warm-graphite top bar with a light rail beneath it, not a
full dark L-shape. The persona switcher is the only pill-shaped object in that
bar and nothing competes with it there.

## Signature element — `<DepartureTrack>`

One component, five contexts:

- `/owner` — 22 rows, the portfolio board.
- `/owner/properties/:id` — one row, with the renewal-decision deadline marked
  on the bar.
- `/tenant` — one row: *your* lease, your decision point on it.
- `/search/:id` — that unit's availability, with queue ticks at the free-date.
- `/search/queue` — every apartment you're waiting on, sorted by date.

Same axis, same amber date chip, same right-to-left flow, five contexts. The
product's argument — *time is the axis, and occupied is not the same as
unavailable* — becomes one physical object the user learns once.

Rows sort by departure ascending, so the board reads like a departures list: the
next thing leaving is at the top.

## What the build changed from the plan

Six things were caught by walking the app rather than by reasoning about it:

1. **The time axis was inverted.** `inset-inline-start` measures from the right
   edge inside an RTL container, so a ratio maps to it directly. The first
   implementation used `1 - ratio` and anchored every bar to the wrong edge.
2. **Currency rendered with the sign on the wrong side.** `he-IL` with
   `style: 'currency'` emits two embedded RLM marks (U+200F) that fight the LTR
   isolate. Digits now come from `Intl`, the `₪` is placed by us.
3. **Vacant units drew a full-width bar** — visually "occupied for 18 months",
   the opposite of the truth. They now show a green dot at today. A pale
   full-width bar on any *other* tone is correct: occupied, no departure in sight.
4. **Recharts' entry animation never fires under StrictMode**, leaving empty bar
   groups. Disabled — product UI shouldn't animate charts in anyway.
5. **Leaflet initialised at zero size** inside the hidden branch of the mobile
   list/map toggle, and its tile fade left loaded tiles at `opacity: 0`. Fixed
   with a `ResizeObserver` + `fadeAnimation={false}`.
6. **`insurance` / `legal` / `arnona` leaked into the UI untranslated** — expense
   categories span ticket categories plus fixed costs, and only one list was
   being consulted. One shared label lookup now covers both.

## Rejected, and why

- **Cream / serif / terracotta editorial** — the saturated 2026 default, and
  wrong for an operations tool used in a stairwell.
- **Near-black with an acid accent** — second-order reflex, and unreadable in
  Israeli daylight.
- **Proptech blue-and-white** — the first-order reflex for the category. Blue is
  demoted to one status colour among five.
- **Per-persona brand colours** — would fight the status palette. Personas
  differ by structure instead.
- **Amber as a general accent** — kills its meaning. It is a semantic token, not
  brand decoration. The seeker's `שריין מקום בתור` CTA was the tempting place to
  break this; it stayed ink-filled, which at 16.3:1 is the loudest thing on the
  page anyway.
- **Greyed-out "occupied" pins** — that is Yad2's model and the exact thing this
  product exists to reject.
- **A third typeface** — Hebrew display faces at UI sizes are a product-register
  ban, and weight range already covers hierarchy.
- **Squeezing the 18-month Gantt onto 390px** — 22 rows × 18 months on a phone is
  not a small Gantt, it's an unreadable one. Mobile gets a month-grouped list
  with the same data and the same chips.
- **Side-stripe accents on list items** — used briefly on the dashboard and the
  mobile track rows, then removed. The status badge already carries the meaning.
- **A direct seeker-to-tenant channel** — the original concept had one. It
  creates a harassment and privacy problem for sitting tenants. The tenant
  answers the *landlord*; the app publishes only a derived availability signal
  (`צפוי להתפנות ביולי`), never identity. Same information, no exposure. The rule
  is enforced in `availabilityKind()` in `src/data/selectors.ts`, which never
  receives the tenant.

## Screening: the constraint as a feature

Israeli anti-discrimination law (חוק איסור הפליה במוצרים, בשירותים ובכניסה
למקומות בידור ולמקומות ציבוריים) reaches landlords renting at scale, which makes
screening a real legal exposure for the product itself.

Rather than treat that as a warning banner, it shapes the data model:
`ScreeningProfile` has **no field** for any protected characteristic, so no
preset can be built on one. Screening is a soft sort — a lead that misses a
criterion ranks lower and is flagged with the reason, and never disappears. Every
decision writes an exportable audit line with the specific reason
("הכנסה של פי 2.2 בלבד — הסף שהוגדר הוא פי 3.5").

That audit log is a genuine selling point for a landlord who is ever challenged,
which is why it is a first-class tab rather than a settings footnote.

## Affiliate disclosure

`/owner/vendors` marks network partners with an amber `שותף רשת` badge and states
the commercial relationship above the list, with the full text one click away.
Partners are **not** boosted in the sort — the ordering is identical for every
vendor, which is exactly what the disclosure claims. Designing the label to read
as a disclosed commercial relationship rather than a neutral quality ranking was
the point.

## Motion

150–250ms, `ease-out-quint`, no bounce. Motion conveys state only: toast entry,
bar width on the track, hover and focus transitions. No orchestrated page-load
sequence — the product loads into a task. `prefers-reduced-motion: reduce` is
honoured globally, and the skeleton delay resolves instantly under it.

---

# Round two

## The undecided apartment

The first build hid apartments whose tenant hadn't decided — they had no
publishable date, so there was nothing to show. That was the same mistake Yad2
makes, one level in: not "hide occupied", but "hide uncertain".

The fix is a chain, not a field: **seeker → owner → tenant → owner → seeker.**
The seeker asks the owner. The owner forwards **one question** to the tenant.
The tenant answers. The owner replies. Uncertainty becomes a date because
somebody asked, and the asking is the product.

Two design commitments hold it together:

1. **The seeker and the tenant never touch.** The tenant sees a question about
   their own lease, never a person. The seeker sees a date, never an identity.
   `availabilityKind()` is never passed the tenant, so the boundary is
   structural rather than a rule someone has to remember.
2. **"Too early to decide" is a real answer.** Adding it to `RenewalIntent`
   alongside `undecided` matters because they mean different things: *I don't
   know* versus *ask me later*. The second one publishes a projected date and
   an implied follow-up; the first doesn't.

The four-step rail on each inquiry card exists so the owner can see where a
request is stuck without opening it. Cards needing the owner are amber-tinted;
everything else is quiet.

**A bug the walkthrough caught:** a tenant who had already answered saw
"you answered" instead of the new question. A standing answer must not hide a
fresh one — intentions change, and the owner asked *because* something changed.
`answered` now excludes the pending-inquiry case.

**A fidelity gap it exposed:** a confirmed departure and a projected one
rendered identically. For a product whose entire pitch is date honesty, that is
the one thing that must not blur. Projected dates now get a dashed outline and
read `צפוי להתפנות ב־` instead of `מתפנה ב־`.

## Move-in / move-out protocol

The item list is deliberately **identical for both directions**. All the value
is in the comparison: a move-out dispute is settled by putting the two runs
side by side, which is only possible if they are the same shape.

Photos are the fastest action on every condition row, because the photo is the
part that actually settles a deposit argument. Meter readings are required
fields — without them there is no way to split a bill.

## Contract intake

The extraction is mocked; **the review step is the real design.** Two fields
come back deliberately low-confidence (deposit at 71%, notice period at 64%)
with source hints explaining why — "נוסח לא סטנדרטי", "מנוסח במילים". A scan UI
that always returns 100% teaches the owner to stop reading it, which is exactly
how a wrong deposit figure ends up in a lease.

Editing a field sets its confidence to 1. A human-confirmed field is not the
same kind of object as a machine-guessed one, and the data should say so.

## Preventive maintenance

`avoided_cost` is the argument: an owner approves a ₪350 AC service when they
can see the ₪1,400 compressor it prevents.

The first version multiplied that out into a ₪445,380 "annual saving", which
assumed **every** skipped task ends in failure. That is a sales number, not a
real one, and a partner would have taken it apart in one question. Every
template now carries a `failure_rate`, and the headline is an expected value.
The honest number is smaller and defensible.

Scheduling opens a real ticket rather than a parallel to-do list, so preventive
and reactive work live in the same board.

## Monetisation, and the lens

The brief was "show me where the money comes from". A slide would have answered
it; a **revenue lens** answers it better. Toggling it marks every earning point
in the running product with its stream and amount — you demo the app and the
app shows you the business model.

Eleven active streams, each naming the surface it fires on, modelled as data so
the projection is arithmetic rather than assertion. Totals compute from the live
portfolio, and the portfolio size is editable so "and at 500 units?" is answered
in the room.

**Three streams are modelled and rejected on purpose**, with the reason shown:

- **Paid queue-jumping.** It would be the easiest money on the list and it
  destroys the fair-screening claim outright. The moment a place in the queue is
  purchasable, the audit log stops protecting anyone and its legal value
  evaporates with it.
- **Broker fees from seekers.** The product sells the removal of the broker.
  Charging a broker fee rebuilds the thing we came to take apart.
- **Selling rental data.** It belongs to the tenants and the owners. Selling it
  burns the trust every other stream sits on.

That section is not modesty. "What did you decide *not* to monetise" is the
second question a serious partner asks, and having an answer is worth more than
one extra stream.

No revenue stream affects ranking, sorting or queue order anywhere in the
product, and every commercial offer is labelled as one at the point it appears.

## Motion

Adopted a single rhythm: custom `ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`)
because the built-in curves are too weak to read as intentional, and never
`ease-in` on UI — it delays the first frame, which is the one the user is
watching.

- **Press feedback on everything pressable.** `scale(0.97)`, 140ms. The
  cheapest thing that makes an interface feel like it is listening.
- **Exit ~65% of enter.** Slow where the user is deciding, fast where the system
  is responding.
- **Transitions, not keyframes**, anywhere an element can be re-triggered
  mid-flight — transitions retarget, keyframes restart from zero.
- **Nothing enters from `scale(0)`.** Sheets start at `0.985`; nothing in the
  world appears from nothing.
- **Popovers and selects scale from their trigger**, not from centre. Modals
  keep centre origin — they aren't anchored to anything.
- **Reduced motion is gentler, not absent.** Opacity and colour transitions aid
  comprehension and stay; movement and scale go.
- The contract scanner uses a sweeping scan line over a document rather than a
  spinner: a spinner says "waiting", the sweep says "reading this".

## Two more bugs the walkthrough caught

- **An infinite render loop on the revenue page.** A zustand selector that
  builds fresh objects fails shallow comparison on every store read. The
  selector must return stable references; the maths belongs in a `useMemo`
  after it.
- **Recharts clipped the Hebrew category labels** on a right-oriented axis down
  to one character each — and on a revenue-mix chart the label *is* the point.
  Replaced with a plain CSS bar list: same information, no library RTL quirks.
