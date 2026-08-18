# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Rising Moon: a full-stack app for hosting Fate RPG (Fate Core / Fate Condensed / Fate Accelerated) tabletop character sheets. Portfolio project, MIT-licensed code, Fate SRD content used under CC BY 3.0 (see README.md for the full attribution/license text — do not remove it).

**Current state: boilerplate + Supabase client plumbing, no auth UI yet.** The Next.js app, monorepo layout, tooling (Prettier, ESLint, Vitest, Playwright), and a local Supabase dev stack (`supabase/`, see below) are in place. `apps/web/src/lib/supabase/client.ts` and `server.ts` (browser/server client factories) and `apps/web/src/proxy.ts` (session-cookie refresh) wire the app up to that local stack — see `/supabase-smoke-test` for a live sanity check. There is still no `profiles` table/RLS (#4), no login/registration UI (#6/#7), and no app-specific business logic (campaign/character schema). Don't assume those exist in the code; check before referencing them.

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

## Architecture

**Monorepo via npm workspaces** (`workspaces: ["apps/*", "packages/*"]` in the root `package.json`):

- `apps/web` — the Next.js 16 App Router app (TypeScript, Tailwind CSS). Currently the only app.
- `packages/shared-types` — `@rising-moon/shared-types`, an empty scaffold package (`src/index.ts` exports nothing yet). It's wired into `apps/web` as a workspace dependency and listed in `next.config.ts`'s `transpilePackages`, so future shared types (e.g. a chat/roll-message shape, sheet-template schema) can be dropped into it and consumed from `apps/web` without extra config.

Tooling is split root vs. per-app: Prettier and `eslint-config-prettier` live at the repo root and apply across the whole monorepo (single shared `.prettierrc`); ESLint itself, Vitest, and Playwright are configured per-app in `apps/web` since it's currently the only lintable/testable workspace.

**Testing setup** (`apps/web`):

- Vitest (`vitest.config.mts`) runs in `jsdom`, with `vite-tsconfig-paths` resolving the `@/*` alias and `vitest.setup.ts` loading `@testing-library/jest-dom/vitest` matchers. Vitest does not support `async` Server Components (a Next.js limitation) — use Playwright for anything async-Server-Component-shaped.
- Playwright (`playwright.config.ts`) builds and starts the app in production mode (`npm run build && npm run start`) rather than using the dev server, per Next.js's own recommendation for e2e.

**Next.js 16 gotcha**: this app runs Next 16, where `middleware.ts` was renamed to `proxy.ts` (exported function `proxy`, not `middleware`) — relevant the moment auth/session or request-interception logic gets added. The installed Next package ships its own version-specific docs at `node_modules/next/dist/docs/` (hoisted to the workspace root, not `apps/web/node_modules`) — check there before assuming an App Router convention matches older Next.js knowledge.
