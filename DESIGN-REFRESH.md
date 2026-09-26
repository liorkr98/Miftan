# Design refresh — plan

Written after a full audit of the current app (two parallel searches: one
against `DESIGN.md`/`PRODUCT.md`/`DECISIONS.md` plus `app.css` for drift, one
grepping every screen for named generic-design patterns). The findings below
are concrete — file:line, not impressions — and this plan is organized around
fixing them, not around a generic "make it better" pass.

## Why this file exists

The app works and is tested, but two people built it in parallel (this
session and Cursor), and a merge just landed. That is exactly the moment small
inconsistencies creep in — a duplicate token, a font size that isn't on the
scale, a semantic color reused for something it doesn't mean. Separately, the
user asked directly: make it look less AI-made, more like a UX/UI designer's
work, and gave explicit permission to change the design completely. This plan
is the concrete list of what that means here, not a restatement of general
design taste.

## What the audit actually found (ground truth, not opinion)

**Token drift** (`app.css` vs the docs): `--color-surface-sunk`,
`--color-line`, `--color-line-strong`, `--color-ink-soft`, `--color-on-ink`,
`--color-on-ink-muted`, `--ease-in-out`, `--ease-out-quart`, `--dur-tooltip`
are all real, used tokens that DESIGN.md never documents. Not bugs — just the
doc trailing the code. `DECISIONS.md` also has a stale value: `--live` at
`0.535` vs the shipped `0.545`.

**Confirmed generic-design patterns** (the actual "AI slop" tells):
- Two identical 3-card grids on the landing page (`landing.tsx:138-163` and
  `170-182`) — icon, heading, one paragraph, repeated with zero variation.
- Two "hero-metric" tiles-in-a-grid shapes: `revenue.tsx`'s `Tile` component
  (`244-259`) and `dashboard.tsx`'s 3-column stat grid (`219-274`) — the exact
  SaaS-dashboard template `DESIGN.md` itself bans.
- `revenue.tsx`'s `KIND_TONE` map (`13-21`) repurposes semantic status colors
  (`--color-signal`, `--color-live`, `--color-open`) as generic categorical
  chart colors — a real violation of "amber means a date exists," not a style
  nitpick.
- 11 hand-built pill/chip shapes that should be `Badge` — most notably
  `departure-track.tsx` (the signature component) never imports `Badge` at
  all, and `revenue.tsx` builds one by hand despite already importing it.
- `contracts.tsx:228,297` — `text-[10px]`, below the documented 12px floor.
- `landing.tsx` — four font sizes (`2.5rem`, `3.5rem`, `2.05rem`, `2.4rem`)
  not on the 8-step scale, plus one hand-authored inline-OKLCH shadow with no
  token backing it (no shadow token exists in the system at all).
- 6 hardcoded Hebrew string literals bypassing `t` (`sign-in.tsx` demo names,
  `vendors.tsx` WhatsApp template, `properties.tsx` city fallback) — the
  project's own zero-exception rule, broken in six small places.
- `apple-touch-icon.svg`'s `aria-label` is corrupted, non-UTF-8 bytes —
  screen readers get mojibake instead of "מפתן."

**Not found anywhere** (worth stating, since it means the base is solid):
zero gradient text, zero decorative glassmorphism, zero side-stripe accent
borders, zero tracked-uppercase eyebrows, zero decorative numbered markers,
zero hand-rolled modals competing with `Dialog`. The 48 raw `<button>`
elements found were individually checked — none are a clean drop-in
replacement for `Button` (they're tabs, list-row navigation, icon-only
controls); no action needed there.

## Phase 0 — Correctness fixes (no design judgment needed)

Do these first; they're unambiguous and everything after builds on a clean
base.

1. Regenerate `apple-touch-icon.svg`'s `aria-label` as valid UTF-8 "מפתן."
2. Fix `DECISIONS.md`'s stale `--live` value (`0.535` → `0.545`).
3. Add the seven undocumented tokens to `DESIGN.md`'s table (they're good
   tokens, just undocumented).
4. `contracts.tsx:228,297` — `text-[10px]` → `text-2xs` (12px floor).
5. Route the 6 hardcoded Hebrew strings through `t` (add i18n keys).
6. Give `departure-track.tsx`'s three hand-built pills, `revenue.tsx`'s
   category pill, and `shell.tsx`'s premium/count pills a real `Badge` (or a
   documented reason each stays custom — the "today" marker on the track
   genuinely might need bespoke positioning the Badge component can't do;
   check case by case rather than blanket-converting).
7. `landing.tsx` — snap the four off-scale sizes onto real tokens (extend the
   scale by one deliberate step if the hero genuinely needs to be larger than
   `--text-3xl`, and document it, rather than leaving four one-off literals).
   Turn the inline-OKLCH shadow into a documented `--shadow-*` token if we
   want shadows in the system at all, or drop it if the panel reads fine
   without one.

## Phase 1 — Fix the two confirmed generic-shape offenders

These are the two patterns a trained eye would actually flag as "AI made
this," so they get real redesign, not a retouch:

- **Landing page's two 3-card grids.** Break the symmetry: vary card size/
  weight by importance (the audiences aren't equally weighted — owners get
  the deepest surface), or replace one grid with a different form entirely
  (a short list, a comparison, an inline sequence) so the page doesn't read
  as "three of the same box, three times."
- **The two hero-metric tile grids** (`revenue.tsx`, `dashboard.tsx`). Both
  are showing a real, specific number that deserves its own presentation —
  not the generic big-number-small-label template. Use `ui-ux-pro-max`
  (`--domain ux "dashboard metric hierarchy"` and `--domain chart`) to find a
  presentation that fits what each number actually is (a rate, a ranked list,
  a projection) rather than forcing all three into identical tiles.
- **`revenue.tsx`'s `KIND_TONE`.** Give the revenue-stream categories their
  own small categorical palette (documented, separate from the status
  tokens), so amber/blue/green keep meaning only what `DESIGN.md` says they
  mean everywhere else in the app.

## Phase 2 — A real motion pass (emil-design-eng)

The emil-design-eng skill is loaded and its rules are already the basis for
the app's motion tokens; this phase is applying its actual method —
"should this animate at all," easing-by-purpose, exit-faster-than-enter — as
an audit across every screen, the same way the skill's own
`find-animation-opportunities` concept works: locate screens with zero
motion, decide screen-by-screen whether motion earns its place there (most
of the owner tooling shouldn't get more than press feedback; the landing
page and empty/success states are where it's warranted), then implement only
where it does. Reuse `--dur-press`/`--ease-out`/`--dur-exit` — no new curves
unless a real gap in the token set turns up.

## Phase 3 — Brand mark

The existing `favicon.svg`/`apple-touch-icon.svg` mark is genuinely good and
on-concept: a doorway on ink, an amber sill — a literal "מפתן" (threshold),
matching the departures-board thesis and the "amber means a date exists"
rule. This phase is refining that mark (after fixing its corrupted a11y
label) and proposing 3-4 named directions building on it, plus one
contrasting alternative, rather than starting from nothing — logo names are
a deliverable of this phase, not a separate task.

## Verification

After each phase: `npm run typecheck && npm run build && npm run test`
(currently 212 API tests + 21 shared, all passing), then a visual pass in
the Browser pane on the local dev server for any screen touched, at both
390px and desktop width, in both light states the app actually supports.
Commit per phase, not as one giant diff — each phase is independently
revertable.
