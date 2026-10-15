# PG Finder PCCOE: Project Rules

Read this before changing anything. These rules apply to people and to AI coding agents.

## 1. Golden rules

1. **Do not touch applied migrations.** Files `001` to `009` in `supabase/migrations/` are already on the live database. Changes go in a new numbered file.
2. **Never put secrets in the repo, the browser, or chat.** No service-role or secret keys, no database password, no access tokens. Only the Supabase URL and publishable key are public.
3. **Never trust the browser.** Roles, owner ids, student ids, statuses, ratings, and verification flags are decided by the database (triggers, RLS), not by form fields or UI state.
4. **Do not disable RLS** or widen grants to make something work. Fix the policy instead.
5. **One small step at a time.** Read-only investigation first, then a small change, then build, then test in the browser, then commit.
6. **Never commit without a review of the diff.** Never push directly to `main`; merge through a pull request.
7. **Do not delete data or run destructive SQL** unless explicitly asked.

## 2. Database rules

- Migrations are idempotent where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`).
- Dry run before pushing: `npx.cmd supabase db push --dry-run`, then `npx.cmd supabase db push`.
- SECURITY DEFINER functions must set `search_path`. Guards that must not apply to definer functions check `current_user IN ('authenticated','anon')`.
- Do not read `public.profiles` for other users. Use the `public_profiles` view or a server action that proves the caller's right.
- Grants are least-privilege. A new table needs explicit grants plus RLS policies.
- Test security changes by impersonating a role in the SQL Editor inside `begin; ... rollback;`.

## 3. Frontend rules

- Keep the existing UI and styling; change layout only when asked.
- Public pages use the server-wrapper + client-component pattern (see architecture.md).
- Real users never see mock data. Mock data is allowed only in dev-only demo mode (`NODE_ENV === 'development'` with placeholder keys).
- Every list needs an empty state; every price shows the rupee symbol; a listing with no reviews shows "New", not "0".
- Validate input in the browser, but remember the database is the real validator.
- Compress images before upload; never upload original phone photos; never use the user's filename in storage paths.
- Do not add npm packages without a reason; prefer what is already installed.

## 4. Workflow rules

- Branch from `main`, work on a feature branch, open a pull request, merge, let Vercel deploy.
- Commit messages: short, imperative (for example "Persist student shortlist to Supabase").
- Stage files by name; avoid `git add .`. The folder `src/app/api/dev-listings` is a local-only temporary route and must never be committed.
- After merging, test on a phone using mobile data.
- If a deploy breaks the site, promote the previous good deployment in Vercel first, then investigate.

## 5. Writing prompts for an AI agent

- Start with the rules: change only what is listed, do not touch `supabase/*`, no `.env.local` access, no commit.
- Ask for read-only reports first when the area is new.
- Ask for short replies (bullets, no code dumps). Check changes with `git diff` instead of asking the agent to paste files.
- Do not trust pasted build output; run `npm.cmd run build` yourself.
- Stop the dev server before an agent runs a build.

## 6. Windows and PowerShell notes

- Use `npm.cmd` and `npx.cmd` (PowerShell blocks the `.ps1` versions).
- Paths with square brackets need `-LiteralPath` in PowerShell, and quotes in git, for example `"src/app/listings/[id]/page.tsx"`.
- Keep the dev server (`npm.cmd run dev`) in its own terminal tab; run other commands in a different tab.
- Terminal characters like `â‚¹` are a display quirk of PowerShell reading UTF-8; the files are fine.
- Use a private window per role when testing two accounts; logins are shared between private windows.

## 7. Before launch (must do)

- Delete all test and sample properties (`supabase/seed/remove_sample_properties.sql` and any test listings).
- Delete the temporary `dev-listings` route if it exists.
- Add email sending that can handle launch load; add bot protection.
- Create a separate production Supabase project and a backup routine.
- Final security pass; review Terms and Privacy pages against what the app actually does.
