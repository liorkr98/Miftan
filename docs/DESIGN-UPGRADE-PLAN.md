# Design upgrade plan — בעל הבית

**Rule: no new features.** Everything here makes what already exists clearer, easier on a phone, more readable and more polished.

**How this was checked (18 Oct 2026):**
- Vercel **Web Interface Guidelines** run over `apps/web/src`
- **taste-skill** on the public pages
- **redesign-skill**, **impeccable** and **emil-design-eng** on the app screens
- Live screenshots at phone width (375px) of the landing, pricing, sign-up and public listing pages
- The signed-in screens were reviewed from the code only: the API is down until Google Cloud is set up.

---

## 1. Focus: one audience on the front door (biggest win)

Your dad's note is right: the product reads as three products. Change the order and the emphasis, not the features.

| What | Now | After |
|---|---|---|
| Landing hero | "לכל דירה יש תאריך", aimed at landlords, tenants and seekers at once | Landlord only: one pain, one promise, one button. Tenants and seekers get one short line lower down. |
| Landing "לוח היציאות" | Says "מתעדכן עכשיו" on sample data | Labelled honestly as a sample; the fake "live" dot goes |
| Landing middle | "שלושה אנשים. מוצר אחד." in three equal columns | The landlord column leads; the other two shrink |
| Landlord menu | 8 items (dashboard, properties, tickets, leads, contracts, finance, reviews, revenue) | 5 core items: home, properties, tickets, rent and finance, contracts. Leads and reviews go under "more". |
| Landlord home | 6 sections at equal weight | One list at the top, "what needs you today" (open tickets, rent not paid, leases ending), then everything else |
| First minutes | Sign up → welcome → add a property. The contract upload is hidden inside "contracts". | The same screens, in the order a landlord needs them: add a property → upload the lease PDF → done |

Skills: `taste-skill` (landing), `redesign-skill`, `impeccable` (critique, distill).

## 2. Mobile pass at 390px

Landlords use phones. Nobody has done a full phone check yet.

- **Wide tables don't fit.** On a phone they scroll sideways. Turn each into a stacked card list below the `md` breakpoint:
  - `personas/owner/finance.tsx:272` (rent table) and `:519` (expenses)
  - `personas/owner/properties.tsx:185`
  - `market.tsx:61` and `revenue.tsx:126` (demo only)
- **Dialogs** (edit flat, record a lease, mark rent paid): on phones they become bottom sheets with `overscroll-behavior: contain`, and the save button stays visible above the keyboard.
- **Touch targets:** 44px everywhere. The small icon buttons on photos and tables need checking.
- **The top bar crowds the screen:** logo, bell, account, pricing and role switcher all share one line. Keep the logo, the bell and one menu.
- **Gestures:** add `touch-action: manipulation` app-wide (no double-tap zoom delay).
- **Safe areas:** the bottom bar already handles them; dialogs and sheets don't yet.

Skills: `frontend-ui-engineering`, `redesign-skill`.

## 3. Readability and Hebrew type

- **The text is too small for the audience.** `text-2xs` is 12px and appears **275 times**. Move body text to 16px, introduce a 13–14px step for secondary text, and keep 12px only for badges.
- **Line height:** Hebrew reads better at 1.6 than at the current 1.47 for small text.
- **Numbers:** prices and dates use IBM Plex Mono, which reads like code. Use Assistant with `tabular-nums` for amounts and tables, and keep mono only where columns must align.
- **Contrast:**
  - The pricing headline "משלמים על דירות, לא על אנשים" renders in pale grey; it looks disabled.
  - Check every `text-muted` on `bg-surface` for 4.5:1 contrast.
- **Headings:** add `text-wrap: balance` so they don't leave a single word on the last line.

Skills: `impeccable` (typeset), `web-design-guidelines`.

## 4. States and feedback

- **Public listing** (`app/public-listing.tsx`): when the API is unreachable it shows an endless skeleton, and the skeleton is a list while the page is a single listing. Make the skeleton match the page and show an error with "נסו שוב" after a timeout.
- **Sign-up** (`app/sign-up.tsx:166-174`):
  - The terms and privacy links render with no space between them ("השימושומדיניות").
  - The submit button is disabled until the box is ticked. Keep it enabled and explain inline instead, as the guidelines ask.
  - The long paragraph under the button can be one sentence.
- **Unsaved changes:** closing the edit-flat, record-lease or mark-paid dialogs throws away what was typed. Ask first.
- **Loading text:** use "שומר…" or "מעלה…" with the ellipsis character `…`, as on upload.
- **Empty states:** each gets one clear action. Most already have one; check every landlord screen.
- **Errors:** show them next to the field and move focus to the first one, rather than only a toast.

Skills: `impeccable` (harden, clarify), `web-design-guidelines`.

## 5. Accessibility (Web Interface Guidelines findings)

- **Focus:** inputs use `focus:outline-none` with only a border change (`components/ui/field.tsx:56`); add a visible `focus-visible` ring. The same applies to select items (`field.tsx:200`) and tab panels (`tabs.tsx:41`).
- **Images:** 18 `<img>` tags have no width or height, so the page jumps as they load:
  - 2 each in `public-listing.tsx`, `tickets.tsx`, `listing.tsx` and tenant `tickets.tsx`
  - 1 each in `photo-manager.tsx`, `unit-detail.tsx`, `properties.tsx`, `crm.tsx` and others
- **Dates:** "today" in `app/landing.tsx:24` and `data/selectors.ts:70,116,136` uses UTC, which is wrong in Israel late at night. Use the `israelToday()` that already exists.
- **Screen readers:** announce form errors and saves with `aria-live` (toasts already do).
- **Brand name:** add `translate="no"` on בעל הבית and on street names, so browser translation doesn't mangle them.
- **Already good:** a skip link exists, there are no `div`s with click handlers, no `transition: all`, reduced motion is respected, and zoom is not blocked.

Skill: `web-design-guidelines`; re-run it after each phase.

## 6. Motion polish

- **One press feel** everywhere; `.press` already exists, so make sure every tappable card and row uses it.
- **Bottom sheets** on phones need an enter and exit animation.
- **No animation** on frequent actions: marking rent paid, ticking a checklist.
- **The landing grid and sweep animations** stop under reduced motion and don't loop forever.

Skills: `emil-design-eng`, `improve-animations`.

## 7. Speed

- **One bundle.** Every screen loads at once: owner, tenant, seeker, charts. Split by route with `React.lazy`, one chunk per role. The map, PDF reader and charts are already loaded on demand.
- **Fonts:** self-host Assistant and drop the Google Fonts request (faster, and private).
- **Images:** add width and height, `loading="lazy"` below the fold, and `fetchpriority="high"` on the listing cover.
- **Polling:** the notification bell polls every minute. Pause it while the tab is hidden.

Skills: `react-best-practices` (Vercel), `performance-optimization`.

---

## Order and size

| # | Phase | Size | Can start now? |
|---|---|---|---|
| 1 | Focus (landing + landlord menu + home) | 2–3 sessions | Landing yes; app screens need the API back |
| 4 | States and sign-up fixes | 1 session | Yes |
| 5 | Accessibility fixes | 1 session | Yes |
| 3 | Readability and type | 1–2 sessions | Yes |
| 2 | Mobile pass | 2–3 sessions | Needs the API back, to check on a phone |
| 7 | Speed | 1 session | Yes |
| 6 | Motion polish | 1 session | Yes |

**Blocked on you:** the Google Cloud setup, so the app runs again and the signed-in screens can be checked on a phone.

**Each phase ends with:**
- A screenshot pass at 375px and desktop, in Hebrew
- `web-design-guidelines` re-run
- CI green
