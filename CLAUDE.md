# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Rising Moon: a full-stack app for hosting Fate RPG (Fate Core / Fate Condensed / Fate Accelerated) tabletop character sheets. Portfolio project, MIT-licensed code, Fate SRD content used under CC BY 3.0 (see README.md for the full attribution/license text — do not remove it).

**Current state: boilerplate + Supabase client plumbing + registration + login + logout + password reset/change + sitewide header/footer.** The Next.js app, monorepo layout, tooling (Prettier, ESLint, Vitest, Playwright), and a local Supabase dev stack (`supabase/`, see below) are in place. `apps/web/src/lib/supabase/client.ts` and `server.ts` (browser/server client factories) and `apps/web/src/proxy.ts` (session-cookie refresh, route guarding, and forwarding the verified user's id/email to Server Components via headers — stripping any inbound copy of those headers first, since a client must never be able to forge them) wire the app up to that local stack — see `/supabase-smoke-test` for a live sanity check. A `profiles` table with RLS (#4) exists, with a case-folded unique index on `display_name` and an `is_display_name_available` RPC. `/register` (#6) and `/login` (#7) are implemented, with an email confirmation callback route (#30) completing the signup flow, so a full register → confirm → log in path works end to end, landing on `/dashboard` (#5) — a protected placeholder page and the route guard's target. Logout (#8) is a sitewide header button. Password reset (#9) is `/reset-password` (request) → emailed link → `/reset-password/confirm` (set new password); the confirm route only accepts a session that actually arrived via that email — `apps/web/src/lib/recovery-marker.ts` mints a short-lived signed cookie (`RECOVERY_MARKER_SECRET` env var) when `/auth/confirm` verifies a `type=recovery` link, and the proxy checks it, redirecting any other authenticated visitor to `/account/password` (#51) instead — an in-app change-password form that re-verifies the current password (GoTrue's `secure_password_change` is on in `supabase/config.toml` to enforce that server-side too, not just client-side). `/account` (#54) is a minimal protected landing page linking to `/account/password`; nothing links to it yet — that's a separate follow-up issue for the header dropdown. A sitewide header (#26) and footer (#43) render on every page via the root layout; the header shows the logged-in user's display name or a `/login` link, and the footer links to `/license` (the Fate SRD/MIT attribution text). Still no app-specific business logic (campaign/character schema). Don't assume that exists in the code; check before referencing it.

## Commands

All commands run from the repo root using npm workspaces (`--workspace=web` targets `apps/web`).

```bash
npm install                          # install all workspaces

npm run dev                          # next dev (apps/web)
npm run build                        # next build (apps/web)
npm run lint --workspace=web         # eslint

npm run format                       # prettier --write, repo-wide
npm run format:check                 # prettier --check, repo-wide

npm run test --workspace=web         # vitest run (unit/component)
npm run test:watch --workspace=web   # vitest, watch mode
npm run test:e2e --workspace=web     # playwright test (requires `npx playwright install` first)
```

### Local Supabase

Requires Docker running locally. The Supabase CLI is a root devDependency (`supabase` package), so `npm run supabase:*` scripts resolve it from `node_modules/.bin` — no global install needed.

```bash
npm run supabase:start   # boots the local stack (Postgres, GoTrue, Realtime, Studio) via Docker
npm run supabase:stop    # tears it down
npm run supabase:reset   # drops and recreates the local DB, replaying supabase/migrations/ and supabase/seed.sql
```

`supabase start` prints the local API URL, anon key, service role key, and Studio URL — copy `apps/web/.env.local.example` to `apps/web/.env.local` and fill those in. Migrations live in `supabase/migrations/`; auth config (password policy, etc.) is in `supabase/config.toml`.

Run a single test:

```bash
npm run test --workspace=web -- src/app/page.test.tsx   # one Vitest file
npm run test --workspace=web -- -t "renders the home"   # by test name
npx playwright test e2e/home.spec.ts                     # one Playwright file (from apps/web)
```

## Development workflow

For each work item (a GitHub issue, a bug, etc.), follow this sequence:

1. Check out a new branch for the work item off `master` (naming convention: `feature/<slug>-issue-<n>` or `fix/<slug>-issue-<n>`, matching existing branch history).
2. Draft a plan — noting whether the change affects this file's "Current state" paragraph or any other part of CLAUDE.md, even if the answer is "no changes needed" — and get it approved before writing code:
   a. Following TDD, write the tests first and present them for approval before implementing.
   b. Implement the change and present it for approval.
   c. Run `/code-review` and present the findings.
   d. Prompt the user to run `/clear`, then propose a commit structure.
3. When proposing a commit structure, keep each commit's tests together with the source changes they test — never split a change from its own test coverage across commits.
4. Before opening a pull request (e.g. via `gh pr create`), audit CLAUDE.md against the diff being introduced — and, where practical, against the current state of the codebase generally. If CLAUDE.md is stale or inaccurate relative to the change, stop and tell the user the specific updates needed instead of opening the PR; proceed only once CLAUDE.md is updated or the user explicitly says to open the PR without updating it.

## Architecture

**Monorepo via npm workspaces** (`workspaces: ["apps/*", "packages/*"]` in the root `package.json`):

- `apps/web` — the Next.js 16 App Router app (TypeScript, Tailwind CSS). Currently the only app.
- `packages/shared-types` — `@rising-moon/shared-types`, an empty scaffold package (`src/index.ts` exports nothing yet). It's wired into `apps/web` as a workspace dependency and listed in `next.config.ts`'s `transpilePackages`, so future shared types (e.g. a chat/roll-message shape, sheet-template schema) can be dropped into it and consumed from `apps/web` without extra config.

Tooling is split root vs. per-app: Prettier and `eslint-config-prettier` live at the repo root and apply across the whole monorepo (single shared `.prettierrc`); ESLint itself, Vitest, and Playwright are configured per-app in `apps/web` since it's currently the only lintable/testable workspace.

**Testing setup** (`apps/web`):

- Vitest (`vitest.config.mts`) runs in `jsdom`, with Vite's native `resolve.tsconfigPaths` option resolving the `@/*` alias and `vitest.setup.ts` loading `@testing-library/jest-dom/vitest` matchers. Vitest does not support `async` Server Components (a Next.js limitation) — use Playwright for anything async-Server-Component-shaped.
- Playwright (`playwright.config.ts`) builds and starts the app in production mode (`npm run build && npm run start`) rather than using the dev server, per Next.js's own recommendation for e2e.

**Next.js 16 gotcha**: this app runs Next 16, where `middleware.ts` was renamed to `proxy.ts` (exported function `proxy`, not `middleware`) — relevant the moment auth/session or request-interception logic gets added. The installed Next package ships its own version-specific docs at `node_modules/next/dist/docs/` (hoisted to the workspace root, not `apps/web/node_modules`) — check there before assuming an App Router convention matches older Next.js knowledge.
