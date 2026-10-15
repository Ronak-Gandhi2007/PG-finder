# PG Finder PCCOE: Project Memory

Facts and decisions that are easy to forget. Short on purpose. No secrets belong in this file.

## Identity and places

- Product: PG Finder PCCOE, student PG discovery near PCCOE, Pimpri-Chinchwad, Pune
- Live site: https://pg-finder-pccoe.vercel.app (Vercel Hobby, auto-deploys from `main`)
- Repository: github.com/gawandeaayush07-hue/PG-finder; work branch used so far: `backend-development` (merged into `main` via pull request #1)
- Supabase project: "PG Finder PCCOE", region Mumbai. Project ref ends in `...bjqerw` (with a **q**). An old handoff note had it wrong with a **g**; always copy it from the Supabase dashboard address bar.
- An older, unrelated Supabase project ("Gamified Self-Transformation Platform") exists. Never use or delete it.
- Tools: Antigravity (AI editor/agent; usage limit is small, so keep prompts short), Windows PowerShell

## Decisions made

- **Free only.** No paid plans, no credit card. Free tiers: Supabase free, Vercel Hobby, GitHub.
- Real data lives in the database; the frontend keeps its original look.
- One entity table (`properties`) so hostels and co-living can be added later.
- Owners cannot self-verify; every new listing starts as "Pending Review" and an admin verifies it (until the admin tools exist, verify by SQL).
- Contact details between students and owners are exchanged through bookings; the student sees a consent line on the tour form.
- Maps: OpenStreetMap + Leaflet (free). Payments: Razorpay test mode first.
- Sample data: 6 fictional PGs near Akurdi, Nigdi, Chinchwad, and Pradhikaran, with obviously fake contact details. Seed and remove scripts are in `supabase/seed/`.

## Gotchas learned

- College email scanners click confirmation links first, so links show "expired". Test accounts were confirmed manually. Fix before launch: email codes and/or Google sign-in.
- Supabase's built-in email sender allows only a few emails per hour; do not repeat signups.
- Do not run a build while the dev server is running; stop the dev server first.
- The agent's pasted build output has been wrong before; always run the build yourself.
- Premium listings are hidden from guests on home and search, so a logged-out visitor sees 4 of the 6 sample PGs.
- Vercel marks `NEXT_PUBLIC_` variables as Config (not Secret); the URL and publishable key are public by design.
- New environment variables only take effect on a new deployment.
- The `inquiries` table in an old handoff note was never created and is not needed.

## Test accounts

A confirmed student account and a confirmed owner account exist for demos (details are kept privately, not here). Do not sign up new accounts live during a demo.

## What is mock vs real (as of this file)

| Area | State |
|---|---|
| Auth, dashboards, protected routes | Real |
| Home, search, listing detail | Real |
| Shortlist, tour bookings | Real |
| Owner add property, photos, delete | Real |
| Reviews | Mock (planned next) |
| Admin dashboard & verification | Real (real queries, student IDs, listings, on-demand signed URLs, approve/reject) |
| Premium and payments | UI only |
| Student settings | Real (profile details, avatar to public bucket, student ID to private bucket) |
| Contact form | Not saved |

## Where things are

- Data layer: `src/lib/listings.ts`, `src/lib/listings-actions.ts`
- Supabase clients: `src/lib/supabase/client.ts`, `server.ts`, `public.ts`, `middleware.ts`; proxy entry `src/proxy.ts`
- Safe redirects: `src/lib/safe-redirect.ts`
- Session and UI state: `src/context/PersonaContext.tsx`
- Migrations: `supabase/migrations/001` to `013`; seeds: `supabase/seed/`
- Other docs: `docs/DATABASE_ARCHITECTURE.md`, `docs/AUTHENTICATION_ARCHITECTURE.md`, `prd.md`, `architecture.md`, `rules.md`, `design.md`, `tasks.md`
