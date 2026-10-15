# PG Finder PCCOE: Tasks

Legend: [x] done and tested, [ ] to do. Update this file whenever something changes.

## Done

### Foundation
- [x] Supabase project (Mumbai), 16 tables, RLS, triggers, indexes, storage buckets (migrations 001 to 006)
- [x] Security hardening: least-privilege grants, `public_profiles` view, profile column protection (007)
- [x] Booking contact snapshot and duplicate-slot protection (008)
- [x] Property integrity guard: no self-verification, auto slug, 10-property limit (009)
- [x] Environment variables and Supabase CLI linked

### Authentication
- [x] Signup, login, logout, email confirmation, callback route
- [x] Role-protected dashboards (server-side), safe redirects, fail-closed proxy
- [x] Persona switcher hidden for real users; role comes from the database only
- [x] Demo data removed for real students and owners; empty states and initials avatars

### Features on real data
- [x] Home, search, and listing detail read from the database (6 sample properties)
- [x] Custom 404 page
- [x] Student shortlist saved per student
- [x] Tour bookings: request, cancel (student); confirm, decline (owner); owner calendar and counts; notification rows for the student
- [x] Owner Add Property with rooms and amenities (starts unverified)
- [x] Owner photo upload with compression, cover photo, delete

### Deployment
- [x] Backend merged to `main`; live on Vercel with environment variables and Supabase redirect URLs

## Next (suggested order)

1. [ ] **Verify the live site** on a phone with mobile data (login, search, heart, booking, owner confirm)
2. [ ] **Reviews**: migration so an owner can mark a Confirmed visit as Completed once its date has passed; real review submit; "Verified Resident" badge; reviews on listing, student, and owner pages
3. [ ] **Admin tools**: verify listings and owners, review documents, hide listings (add an admin-only `admin_hidden` flag), moderate reports
4. [x] **Student settings**: save profile, avatar upload to public bucket, student ID upload to private bucket (011)
5. [ ] **Owner verification documents** upload and admin review
6. [ ] **Contact form** saving support tickets through a server action
7. [ ] **Notifications**: bell or inbox for students; notify owners of new requests
8. [ ] **Email and signup capacity**: Google sign-in, free SMTP provider, 6-digit email codes, bot protection (target 100+ signups per hour)
9. [ ] **Maps**: OpenStreetMap + Leaflet using stored coordinates; owner picks location when adding a property
10. [ ] **Payments** (Razorpay test mode first): server order creation, signature verification, webhook, server-only writes; decide what Premium unlocks
11. [ ] **Owner analytics** on real numbers (revenue, views)

## Known issues and gaps

- Reviews, admin dashboard, premium/payments, and contact form are still mock or UI-only
- Students can post unverified reviews once reviews are wired (badge shows only after a Completed visit)
- Rescheduling: owners can set the status but date/slot cannot change after creation
- Shortlist rule does not check that the user is a student (app blocks owners; database does not)
- Owners can edit a verified listing's text and prices without re-review
- Property contact phone and email are publicly readable
- A student phone number only gets a length check
- Dashboard pages take about a second for the session check
- Shortlist cards show "0" instead of "New" for unrated PGs
- No automatic backups or monitoring on the free plan

## Before launch checklist

- [ ] Remove sample and test properties (`supabase/seed/remove_sample_properties.sql`, plus any test listing such as "Photo Test PG")
- [ ] Confirm `src/app/api/dev-listings` was never committed
- [ ] Separate production Supabase project; backup routine
- [ ] Email sending that can handle launch load; bot protection on signup
- [ ] Review Terms, Privacy, and Trust pages against actual behaviour
- [ ] Error monitoring and a final security pass
- [ ] Pilot with a small group of real students and one or two real owners
