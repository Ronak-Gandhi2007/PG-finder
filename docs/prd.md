# PG Finder PCCOE: Product Requirements (PRD)

Status: live prototype with a real backend (auth, listings, shortlist, tour bookings, owner listings and photos). Payments, reviews, and admin tools are still to build.
Live site: https://pg-finder-pccoe.vercel.app

## 1. Problem

Students at PCCOE (Pimpri-Chinchwad, Pune) find paying-guest (PG) accommodation through brokers, WhatsApp groups, and word of mouth. Listings are unverified, prices are unclear, and there is no single place to compare options by distance, price, and amenities. Owners have no simple way to reach students directly.

## 2. Goal

A free, trustworthy platform where students discover verified PGs near campus and book tours directly with owners, with no brokers.

## 3. Users

| Role | What they need |
|---|---|
| **Student** | Search and filter PGs, view photos/rooms/amenities, shortlist, request a tour, later leave reviews |
| **Owner** | List a property with rooms and photos, receive and confirm tour requests, see basic numbers |
| **Admin** | Verify owners and listings, moderate reports and reviews (not built yet) |

Admins cannot self-register. Owners and students choose their role at signup; admin is assigned only in the database.

## 4. Scope

### In scope (built)
- Email signup, login, logout, email confirmation, role-protected dashboards
- Public home, search (filters: distance, price, gender type, sort), listing detail with photos, rooms, amenities
- Shortlist saved per student
- Tour booking: student requests a date and slot, owner confirms or declines, student sees status and can cancel, student gets a notification record on confirm/decline
- Owner: add property (rooms, amenities), upload up to 6 compressed photos, set cover photo; new listings start as "Pending Review"
- Custom 404 page

### In scope (not built yet)
- Reviews (verified residents only) and rating updates
- Admin tools: verify listings and owners, review documents, moderate reports
- Student settings save, avatar and student ID upload
- Support/contact form saving tickets
- Email delivery at scale and notification display (bell/inbox)
- Premium subscription and payments (Razorpay, test mode first)
- Maps (OpenStreetMap/Leaflet) using stored latitude/longitude

### Out of scope for v1
Live chat, in-app payments for rent, native mobile app, listing outside the PCCOE area.

## 5. Key user stories and acceptance

1. **Student finds a PG.** Opening /search shows verified listings; changing the distance slider, price, or gender filter updates results; premium listings are hidden from logged-out visitors.
2. **Student requests a tour.** On a listing page, a logged-in student picks a date and slot and submits. The request shows as Pending on their dashboard. Requesting the same slot twice is refused.
3. **Owner confirms.** The owner sees the request with the student's name, email, and phone (shared with consent noted on the form), and can confirm or decline. The student sees the new status.
4. **Owner lists a property.** The owner fills a form with rooms and amenities, uploads photos, and the listing stays hidden from students until an admin verifies it.
5. **Nobody can cheat.** Owners cannot self-verify, set ratings, or become admin; students cannot read other users' contact details.

## 6. Constraints

- **Cost: zero.** Free tiers only (Supabase free, Vercel Hobby, GitHub). Note: Vercel Hobby is for non-commercial use under Vercel's terms.
- **Launch load:** target at least 100 signups per hour. This needs a free email-sending setup and/or Google sign-in, because the default Supabase email sender allows only a few emails per hour.
- **Security first:** personal data (phone, email, ID documents) must stay private; see architecture.md and rules.md.

## 7. Success measures (suggested)

- Signup to first tour request conversion
- Number of verified listings and owners
- Tour requests confirmed within 48 hours
- Zero security incidents

## 8. Risks

| Risk | Mitigation |
|---|---|
| Free email limit blocks signups | Google sign-in, free SMTP provider, 6-digit email codes, bot protection |
| College mail scanners consume confirmation links | Email codes instead of links |
| Free Supabase project pauses after inactivity, no backups | Regular use; scheduled export to a private repo |
| Fake or abusive listings | Admin verification before a listing is public; reports; owner document checks |
| Public contact details on listings | Decide later whether to reveal only to logged-in students |
