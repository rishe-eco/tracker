# Tracker

Goal-execution app, and the as-built implementation of Root's **Organize** pillar. Two deployables in one repo.

| Path | What it is | Stack |
|---|---|---|
| **`api/`** | GraphQL backend | Express · Apollo Server · GraphQL · Prisma · **SQLite** · JWT + bcrypt |
| **`client/`** | PWA frontend | React · React Router · Vite · Apollo Client · Tailwind · Radix · i18next (bilingual, RTL) |

**Documentation lives elsewhere.** The canonical description of what Tracker is, its domain model, architecture, conventions, roadmap and decision history is in [`rishe-eco/root-sot`](https://github.com/rishe-eco/root-sot) under `tracker/`. This repo holds code only.

Before changing anything, read `tracker/canon/02-architecture/04-conventions.md` in that repo — it's the file that most prevents mistakes.

## Quick start

Install per workspace (there is no root `package.json`; these are two independent npm projects):

```bash
cd api && npm install && cd ../client && npm install
```

Set up the database — SQLite by default, so no server needed:

```bash
cd api && npx prisma migrate dev && npx prisma generate
```

Run both dev servers at once:

```bash
./run-dev.sh
```

On Windows use `run-dev.cmd` instead. Both scripts just run `npm run dev` in `api/` and `client/`.

## Per-workspace commands

**`api/`** — `npm run dev` (nodemon) · `npm run build` (tsc) · `npm start` · `npm test` (vitest) · `npm run test:watch`

**`client/`** — `npm run dev` (vite) · `npm run build` · `npm run preview` · `npm run typecheck` (react-router typegen + tsc) · `npm test` (vitest) · `npm run test:e2e` (playwright, plus `:ui` / `:headed`) · `npm run i18n:check-hardcoded` · `npm run i18n:check-missing` · `npm run generate-pwa-assets`

## Environment

**`api/.env` is not in version control and you must create it.** See `api/SETUP.md` for the full setup, including how to switch from SQLite to Postgres (the Postgres `datasource` block is present but commented out in `prisma/schema.prisma`).

At minimum:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="<a strong random value>"
```

> **`JWT_SECRET` is load-bearing.** The code falls back to `dev-secret` when it is unset. Never deploy with that fallback in effect.

The API also uses `@anthropic-ai/sdk`, so an Anthropic API key is required for the features that call it.

**`client/.env` and `client/.env.production` are committed on purpose** — they hold only API URLs, no secrets. Production uses a relative `VITE_API_URL="/graphql"` because nginx serves the app and the API from the same origin. Machine-specific overrides go in `.env.local`, which is ignored.

## Testing

The backend has unit coverage (auth, overlap, recurrence) and integration coverage (actions, auth, gathering, goals, milestones, projects, today, journals). The frontend has Playwright end-to-end suites across auth, actions, goals, journals, navigation, projects and today. Playwright generates credentials into `e2e/.auth/`, which is ignored.

## Deployment

Both workspaces have a `Dockerfile`; `api/docker-compose.yml` covers the backend. The VPS runbook is `tracker/DEPLOY-VPS.md` in the `root-sot` repo. Production topology: host nginx terminates TLS and routes `/graphql` to the backend container, with app backends on localhost ports.

## Repository notes

- **This repo was consolidated on 2026-07-29** from two separate repos (`markRiceOld/trackerApi` and `markRiceOld/trackerProject`), which remain as the historical record. History was not carried across the move — this repo starts at `init`.
- The workspaces still carry their original package names, `tracker-api` and `tracker-project`. Renaming them to match the new `api/` and `client/` paths is a deliberate follow-up, not part of the move.
- `client/dist/` was tracked in the old repo despite being gitignored (it predated the ignore rule). It is Vite/PWA build output, regenerable from `client/public/` via `npm run build`, and is **not** tracked here.
