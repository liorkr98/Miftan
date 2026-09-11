# Product

## Register

product

## Users

Three people, in genuinely different situations, using one responsive web app.
Role comes from the account's real relationships — owning a property, holding a
live lease, queueing for one — never from a toggle.

**בעל דירות · the landlord.** Mid-forties to sixties, two to twenty-five units,
no property manager. Uses the product in gaps: in a car, in a stairwell, between
meetings. His questions are operational and time-shaped — *what is empty and
when*, *do I approve this ₪900 call-out*, *who is in the queue for לבנדה 14*.
Most of what he needs is a decision he can make in ten seconds without reading.

**דייר · the tenant.** Uses the product four or five times a year and never
wants to think about it otherwise. Reports a fault, confirms a tradesperson's
visit, answers a renewal question, finds a receipt. Their surface is deliberately
small; every screen they see should be finishable in under a minute on a phone.

**מחפש דירה · the seeker.** Looking for a specific month, not for tonight — the
job is planning, not browsing. Wants to know which apartments will be free when,
including the ones nobody has listed yet, and where they stand in line.

## Product Purpose

Israeli rental listings only show apartments that are already empty. Everybody
searches at the same moment for the same handful of units, and the flat that
frees up in October is invisible until October. Miftan's claim is that **every
apartment has a date** — occupied ones included — and that surfacing the schedule
instead of the boarding gate is worth more to all three sides than another
listings board.

Around that sits the operational half that makes a landlord log in weekly at
all: maintenance with a real state machine, preventive work priced honestly,
screening with an audit trail, protocols that settle deposit arguments.

Success is a landlord who stops keeping the portfolio in their head, a tenant who
reports a leak instead of living with it, and a seeker who plans a move three
months out.

## Brand Personality

**Operational, candid, unhurried.**

The voice is a competent colleague, not a brand. It states what is true, says
what it does not know, and never oversells a number — the preventive-maintenance
figure is an expected value with the arithmetic printed under it precisely
because the gross figure would have been more impressive and less honest.

Hebrew first, always. Not a translated English product.

## Anti-references

- **Cream / serif / terracotta editorial.** The saturated 2026 default, and
  wrong for a tool used one-handed in a stairwell.
- **Near-black with an acid accent.** The second-order reflex, and unreadable in
  Israeli daylight.
- **Proptech blue-and-white.** The first-order reflex for the category. Blue is
  demoted to one status colour among five.
- **Yad2's greyed-out "occupied" pin.** The exact model this product exists to
  reject.
- **Broadsheet hairline rules and tracked eyebrows.** Hebrew has no uppercase;
  the whole small-caps hierarchy toolkit does not exist here.
- **Dashboards that congratulate you.** Vanity metrics, celebratory empty
  states, numbers with no denominator.

## Design Principles

1. **Time is the organising idea.** The departures board is not decoration; it
   is the product's thesis rendered as a component. Where a screen can be
   arranged by *when*, it is.
2. **Privacy is shape, not filter.** A seeker's response has no `tenant` key to
   leak. Three roles get three different response schemas, so a boundary cannot
   be forgotten in a conditional.
3. **Never overstate a number.** Expected values over gross ones, denominators
   next to percentages, and the arithmetic shown when the figure is an argument.
4. **The landlord is holding a phone at arm's length.** Large numerals, high
   contrast, decisions before detail. Light theme, because half the usage is
   outdoors.
5. **Amber means "there is a date."** Status colour is semantic and is never
   spent on brand decoration. The moment amber becomes an accent it stops
   meaning anything.

## Accessibility & Inclusion

- WCAG 2.2 AA. Body text ≥4.5:1 — the verified pairs live in
  `apps/web/src/styles/app.css` (ink/bg 16.3:1, muted/bg 5.3:1).
- **RTL is the default direction, not a mode.** LTR islands — ₪ amounts, phone
  numbers, dates, meter readings — are isolated so they cannot scramble the
  Hebrew around them.
- Status is never carried by colour alone; every status chip has a label.
- `prefers-reduced-motion: reduce` honoured globally, including skeleton delays.
- Target size ≥44px on anything a tenant taps on a phone.
- Presbyopia is the assumed default for the landlord: 12px is the floor and it
  is used sparingly.
