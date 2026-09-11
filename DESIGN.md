# Design

Visual system for מפתן. Strategy lives in [PRODUCT.md](PRODUCT.md); the full
reasoning and the rejected alternatives live in [DECISIONS.md](DECISIONS.md).
Tokens are defined once, in `apps/web/src/styles/app.css`.

## Theme

**Light, warm-neutral, high contrast.** Forced by the scene, not chosen for
taste: half the usage is a landlord holding a phone at arm's length in Israeli
daylight, or in a stairwell at 20:40. Dark is reserved for app chrome — a warm
graphite top bar over a light rail, never a full dark L-shape.

Colour strategy is **Restrained with one Committed element**: tinted neutrals
carry the surface, and a single amber does one job so loudly that it becomes the
product's argument.

## Color

Composed in OKLCH around a cobalt seed, then re-derived warm. Every ratio below
is measured.

| Token | Hebrew | OKLCH | Hex | Job |
|---|---|---|---|---|
| `--color-ink` | פחם | `0.245 0.018 52` | `#281E19` | chrome, headings, body, primary buttons — **16.3:1** on bg |
| `--color-bg` | לובן | `1 0 0` | `#FFFFFF` | canvas |
| `--color-surface` | גיליון | `0.975 0.005 66` | `#F9F5F2` | panels, rail |
| `--color-signal` | ענבר | `0.785 0.145 78` | `#EBAC39` | **"there is a date"** — ink-on-amber **8.1:1** |
| `--color-live` | תכלת | `0.545 0.088 250` | `#4674A2` | occupied · in progress · settled — **4.9:1** |
| `--color-open` | פנוי | `0.545 0.105 158` | `#2E8258` | vacant now · done — **4.7:1** |
| `--color-alert` | אזעקה | `0.545 0.185 30` | `#C53324` | urgent · overdue — **5.4:1** |
| `--color-muted` | — | `0.528 0.015 60` | `#726963` | secondary text — **5.3:1**, deliberately not a light gray |
| `--color-signal-deep` | — | `0.47 0.115 68` | `#844C00` | amber as text — **7.0:1** |

Each status colour has a `-soft` tint for fills. Warm neutrals carry
+0.005–0.015 chroma toward hue 66 — the brand's own hue, never warm-by-default.

### Two rules that make it a system

1. **Amber never appears on a button.** Amber means *a date exists*: timeline
   bars, availability chips, map pin fills. Nothing else. Primary actions are
   ink-filled at 16.3:1, which is the loudest thing on any page anyway. The
   moment amber becomes a general accent it stops meaning anything.
2. **Temperature carries semantics.** Warm (amber, red) = upcoming, or needs a
   person. Cool (blue) = settled, nothing to do. Green = open now. This only
   works because the chrome is warm, which leaves blue as the single cool
   colour in the system.

`מתפנה ביולי` is louder than `פנוי עכשיו`. That inversion is the design argument.

## Typography

Two faces on a real contrast axis — humanist sans against a geometric mono.

- **Assistant** (200–800) for everything. The humanist Israeli face, and the
  single biggest warmth lever available. Heebo reads technical (Roboto-derived);
  Rubik's rounding reads consumer.
- **IBM Plex Mono** (400–600) for numerals in board and table contexts only.

**Hebrew has no uppercase**, so the entire small-caps / tracked-eyebrow
hierarchy toolkit does not exist here. Hierarchy comes from weight, size and
colour alone — which makes weight range the decisive property of the family.

The mono is functional, not decorative: those numerals are columnar data *and*
LTR islands inside RTL text that need visual isolation anyway. Inline ₪ amounts
inside prose stay in Assistant with `font-variant-numeric: tabular-nums`, so the
UI never reads as debug output.

Scale is fixed rem, ratio ~1.2: `12 · 13 · 14 · 16 · 19 · 23 · 28 · 33`. Base 16,
UI labels 14, floor 12 used sparingly — presbyopia is the assumed default.

## Layout

**One shell, three genuinely different topologies.** Personas differ by
structure, not hue; recolouring per persona would collide with the status
palette, which is the colour system's actual job.

- **Owner** — left rail, seven dense sections, tables and boards.
- **Tenant** — no rail, five large destinations, finishable in a minute.
- **Seeker** — no rail, filter bar over a full-bleed map/list.

Geometry: `--radius-control: 10px`, `--radius-card: 12px`, `--radius-panel: 14px`.

Semantic z-scale, never arbitrary values: dropdown 10 → sticky 20 → map-overlay
25 → backdrop 30 → modal 40 → toast 50 → tooltip 60.

**Direction is RTL by default, not a mode.** `inset-inline-start` measures from
the right edge; time on the departures board flows right-to-left. Any LTR island
is explicitly isolated.

## Signature element

`<DepartureTrack>` — one component, five contexts: the owner's 22-row portfolio
board, a single unit's detail, the tenant's own lease, a listing's availability,
and the seeker's queue. Same axis, same amber date chip, same right-to-left
flow. Rows sort by departure ascending, so it reads like a departures list.

On phones the 18-month Gantt becomes a month-grouped list with the same data and
the same chips — 22 rows × 18 months at 390px is not a small Gantt, it is an
unreadable one.

## Motion

Custom curves, because the built-in CSS easings are too weak to read as
intentional. **Never `ease-in` on UI** — it delays the first frame, which is
exactly when the user is looking.

| Token | Curve / duration |
|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` |
| `--dur-press` | 140ms |
| `--dur-menu` | 200ms |
| `--dur-sheet` | 280ms |
| `--dur-exit` | 180ms — exit is ~65% of enter |

Motion conveys state only: press feedback at `scale(0.97)`, bar width on the
track, toast entry, hover and focus. No orchestrated page-load sequence — the
product loads into a task, not a performance. Transitions rather than keyframes
for anything re-triggerable. Nothing ever enters from `scale(0)`.

`prefers-reduced-motion: reduce` is honoured globally and resolves skeleton
delays instantly.

## Banned

- Side-stripe accents on list items — the status badge already carries it.
- Amber as a general accent.
- Greyed-out "occupied" states.
- A third typeface.
- Tracked uppercase eyebrows and numbered section markers.
- Gradient text, decorative glassmorphism, nested cards.
