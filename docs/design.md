# PG Finder PCCOE: Design Guide

Written from the UI as built. Exact colour values and spacing scales live in the Tailwind theme (`src/app/globals.css`); check there before relying on any value, because this guide records the class names and rules in use, not the hex codes.

## 1. Look and feel

Calm, trustworthy, student-friendly. Soft sage greens on light backgrounds with a deep green as the main brand colour, generous white cards with large rounded corners, and gentle motion. The home page has an animated fluid (WebGL) background, smooth scrolling (Lenis), and scroll animation (GSAP).

## 2. Design tokens in use

| Purpose | Class names seen |
|---|---|
| Brand colour | `deep-green`, `light-sage`, `primary`, `on-primary` |
| Text | `on-surface`, `on-surface-variant`, `text-primary` |
| Borders and surfaces | `outline-variant`, `surface-container`, `surface-container-low` |
| Shape | `card-radius`, `btn-radius`, `input-radius`, `rounded-full` for pills and avatars |
| Elevation | `shadow-level-1`, `shadow-level-2`, `glass-panel` (frosted card), `hover-lift` |
| Type scale | `font-display-lg`, `font-headline-lg`, `font-headline-md`, `font-body-lg`, `font-body-md`, `font-label-md`, `font-label-sm` |
| Layout | `max-w-max-width`, `px-margin-mobile`, `md:px-margin-desktop`, `gap-gutter` |
| Icons | Material Symbols Outlined (for example `school`, `payments`, `location_on`, `favorite`) |

## 3. Components and patterns

- **Listing card:** photo with price pill (top right), "Premium" pill (top left), title, location, distance chip, gender chip ("Boys PG"), View Details button. A rating star with the number, or a **"New"** badge when there are no reviews.
- **Badges:** Verified (green), Pending Review (amber), status badges for bookings: Pending (neutral), Confirmed (emerald), Declined (rose), Rescheduled (amber), Cancelled (grey).
- **Avatars:** initials circle (for example "AG") when there is no photo; never a stock photo for real users.
- **Dashboards:** left sidebar card with avatar and navigation, content cards on the right; stat tiles across the top.
- **Forms:** white card, small labels, rounded inputs, deep-green primary button, inline error text under the form, disabled state while saving.
- **Empty states:** icon, one-line message, one helpful button (for example "No tours scheduled yet" with "Explore PGs").
- **Photo manager (owner):** thumbnail grid, "Cover" badge on the primary photo, hover actions for Make cover and Delete.
- **404 page:** very large "404" and "Page not found" in black text, short explanation, buttons to Home and Browse PGs.

## 4. Rules

- Reuse existing classes and components before inventing new ones.
- Money is shown as `₹` with thousands separators and "/mo".
- Never show demo data to real users; show real zeros and empty states.
- Premium listings are hidden from logged-out visitors on home and search.
- Buttons that a role cannot use are disabled with an explanation (for example owners see "Only students can request visits").
- Keep text readable: dark text on light cards; do not inherit white text from the hero onto pages with light backgrounds.

## 5. Responsive and accessibility

- Mobile first: single column on phones, grids from `md`. Check each page at phone width.
- Every image has `alt` text; form inputs have labels (use `sr-only` when hidden visually).
- Keyboard focus must remain visible on buttons and inputs.
- Respect reduced motion for the animated background where possible (not yet implemented).

## 6. Open design items

- Notification bell or inbox for students (notifications exist in the database but are not shown)
- Map view on search and the listing page
- Review cards with a "Verified Resident" badge
- Mobile polish pass on dashboards and the owner photo manager
- Loading skeletons and error states for failed data loads
