# PG Finder PCCOE: Architecture

Complements `docs/DATABASE_ARCHITECTURE.md` and `docs/AUTHENTICATION_ARCHITECTURE.md` (written earlier). This file is the one-page overview of how everything fits together as built.

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.3 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 |
| Visuals | Three.js fluid shader, GSAP, Lenis smooth scroll |
| Backend | Supabase: PostgreSQL, Auth, Storage, Row Level Security (RLS) |
| Hosting | Vercel (Hobby), GitHub for source |
| Session | `@supabase/ssr`, cookie-based sessions, PKCE |

## 2. Big picture

```
Browser ──► Vercel (Next.js)
              │  server pages + server actions + proxy.ts
              ▼
          Supabase (Mumbai)
   ┌────────┬───────────┬──────────┐
   Postgres   Auth       Storage
   (RLS +     (users,    (property-images, ...)
   triggers)  sessions)
```

Rule of thumb: the browser may talk to Supabase using only the **publishable key**. Every permission is enforced by the database (RLS policies, column grants, triggers), never by the UI.

## 3. How a page gets its data

Public pages use a **server wrapper + client component** pattern:

| Route | Server file | Client file |
|---|---|---|
| `/` | `src/app/page.tsx` | `HomeClient.tsx` |
| `/search` | `src/app/search/page.tsx` | `SearchClient.tsx` |
| `/listings/[id]` | `.../page.tsx` | `ListingClient.tsx` |

The server file calls `getListings()` or `getListingById()` in `src/lib/listings.ts`, which uses a cookie-free public Supabase client (`src/lib/supabase/public.ts`) and maps database rows to the `Listing` shape the UI uses. Pages cache for about 60 seconds.

`src/lib/listings-actions.ts` is a thin server action so the student shortlist page can load listings by id.

Logged-in data (shortlist, bookings, owner's properties and photos) is loaded in the browser with the browser Supabase client (`src/lib/supabase/client.ts`) under RLS.

## 4. Auth and authorization

1. Signup/login use Supabase Auth; the signup trigger `handle_new_user()` creates the `profiles` row. Metadata `role` is accepted only for STUDENT or OWNER; ADMIN is downgraded to STUDENT.
2. `src/proxy.ts` calls `updateSession` in `src/lib/supabase/middleware.ts`: refreshes the session with `getUser()`, reads the real role from `profiles`, and redirects wrong-role visitors away from `/dashboard/*`. In production it fails closed if keys are missing.
3. `/auth/callback` exchanges the email code for a session; redirects are checked by `src/lib/safe-redirect.ts` (no open redirects).
4. `PersonaContext` mirrors the real session for the UI only. Role comes only from `profiles.role`. A dev-only demo mode exists when `NODE_ENV=development` and keys are placeholders; it never runs in production.

## 5. Database

16 tables: `profiles`, `properties`, `property_images`, `rooms`, `amenities`, `property_amenities`, `shortlists`, `bookings_visits`, `reviews`, `notifications`, `verification_documents`, `reports_flags`, `support_tickets`, `premium_subscriptions`, `payment_transactions`, `owner_tour_availability`.

Migrations (applied in order, never edited after applying):

| # | Purpose |
|---|---|
| 001 | Schema, constraints |
| 002 | RLS policies |
| 003 | Indexes |
| 004 | Triggers and functions (rating stats, notifications, verification approval) |
| 005 | Storage buckets |
| 006 | Security fixes (booking and review integrity, role protection, storage ownership) |
| 007 | Grants (least privilege), `public_profiles` view, profile column protection, no client writes to payments |
| 008 | Booking contact snapshot (student name/email copied by trigger), unique active slot |
| 009 | Property integrity (owners cannot self-verify, premium, or set ratings; slug auto-generated; max 10 properties per owner) |

Key protections:
- `anon` and `authenticated` hold only the table privileges the app needs (007).
- `profiles` is readable only by its owner and admins; public pages read the `public_profiles` view (id, name, avatar, verified flag, college), limited to owners and review authors.
- Booking `owner_id`, student name and email are set by triggers, not the client; booking date, slot, and contact are immutable after creation.
- Property `is_verified`, `is_premium`, `rating`, `reviews_count`, `owner_id`, `slug` cannot be changed by owners.

## 6. Storage

| Bucket | Visibility | Limit | Notes |
|---|---|---|---|
| `property-images` | public | 5 MB, jpeg/png/webp | Path `<property_id>/<random>.webp`; only the property's owner can write. The app compresses to max 1600px WebP before upload, max 6 photos per property |
| `verification-documents` | private | 10 MB | Owner documents (not wired in UI yet) |
| `user-avatars` | public | 2 MB | Not wired in UI yet |
| `student-id-documents` | private | 5 MB | Not wired in UI yet |

## 7. Environment and deployment

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel (Production + Preview) | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same | Public by design |
| Secret/service-role keys | Never in the repo or browser | Server-only if ever needed (payments webhook) |

- `main` is the production branch (auto-deploys to Vercel). Work happens on feature branches and is merged by pull request.
- Supabase Auth must list the live site URL and `/auth/callback` under URL Configuration.
- Database changes ship as new numbered files in `supabase/migrations/`, pushed with `npx supabase db push` (dry run first).

## 8. Planned additions

- Reviews, admin verification tools, student settings and uploads
- Payments: server creates the order, server verifies the signature, webhook confirms, server-only writes (Razorpay test mode first)
- Email: free SMTP provider and/or Google sign-in, 6-digit codes, bot protection
- Maps: OpenStreetMap + Leaflet using stored latitude/longitude
