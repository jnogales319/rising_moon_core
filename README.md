# Rising Moon

A full-stack app for hosting and managing tabletop RPG character sheets,
built around the Fate system (Fate Core / Fate Condensed / Fate
Accelerated). Portfolio project — no billing or monetization.

This repo is currently at the setup/boilerplate stage: project structure,
tooling, and packages only. Schema and application features land in later
PRs.

## Tech stack

- **Frontend/Backend:** Next.js (App Router, TypeScript) — UI and API routes
  in one app
- **Database:** Postgres via [Supabase](https://supabase.com) (planned, not yet wired up)
- **Styling:** Tailwind CSS
- **Testing:** Vitest + React Testing Library (unit/component), Playwright (e2e)
- **Formatting/Linting:** Prettier, ESLint

## Project structure

```
apps/
  web/                  Next.js app (frontend + API routes)
packages/
  shared-types/         Shared TS types package (empty scaffold for now)
```

npm workspaces link `packages/*` into `apps/web` — see the root
[package.json](package.json).

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Formatting & linting

```bash
npm run format          # prettier --write
npm run format:check    # prettier --check
npm run lint --workspace=web
```

## Testing

```bash
npm run test --workspace=web       # Vitest (unit/component)
npm run test:watch --workspace=web
npm run test:e2e --workspace=web   # Playwright (requires: npx playwright install)
```

## License

Code in this repository is licensed under the [MIT License](LICENSE).

This project uses the Fate system under the [Fate SRD](https://www.evilhat.com/home/fate-srd/),
licensed under the [Creative Commons Attribution 3.0 Unported license](https://creativecommons.org/licenses/by/3.0/)
by Evil Hat Productions, LLC. Fate SRD content (rules text, terminology)
is governed by that license, separately from this repository's MIT-licensed
code. No Evil Hat trademarks, logos, or official artwork are used; all
visual design is original.

---

This is an unofficial fan tool for the Fate system, used under the Fate SRD
license. Not affiliated with or endorsed by Evil Hat Productions.
