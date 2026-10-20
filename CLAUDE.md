# Tracker — for Claude

Root's goal-execution app, and the staging ground where pillar prototypes are built and felt. Bilingual, English and Persian (right to left). Two npm projects, with no root `package.json`: `api/` (Express, Apollo Server, Prisma, SQLite, JWT) and `client/` (React Router, Vite PWA, Apollo Client, Tailwind, Radix, i18next). The repo is **public**.

## Read first

1. **`tracker/canon/02-architecture/04-conventions.md`** in `rishe-eco/root-sot`: thirteen rules, each with the bug it prevents. It's the file that most prevents mistakes, and this file doesn't repeat it.
2. The rest of the canon is beside it in `tracker/canon/`: the data model, the API and the frontend (`02-architecture/`), testing (`03-engineering/01-testing.md`), and what is built and broken (`04-roadmap/`).
3. On *what Tracker should become*, the spec wins; on *what it is now*, this repo wins.

Work is planned and reviewed by the lifecycle method in root-sot's `lifecycle/`. This project's paths, suites and lane slots are in `lifecycle/projects/tracker/config.md`.

## Commands

```bash
cd api && npm install && npx prisma generate     # then: cd client && npm install
./run-dev.sh                                     # both dev servers; run-dev.cmd on Windows
cd api && npx vitest run <files>                 # API unit and integration, targeted
cd client && npx vitest run <files>              # component tests, useApi mocked
cd client && npx tsc --noEmit && npm run i18n:check-missing && npm run i18n:check-hardcoded
cd client && npx playwright test <spec> -g <name>
```

The full suites (`npm test` in each, `npm run test:e2e`) run at milestones, one at a time on a machine.

## Environment

- **`api/.env` isn't in git:** `DATABASE_URL="file:./dev.db"`, `JWT_SECRET` (the code falls back to `dev-secret`; never deploy with it), `CORS_ORIGINS`, and an Anthropic key for the features that call it.
- **SQLite, no Docker.** API tests push a fresh `api/prisma/test.db` per checkout. Integration tests take 5–10 s each; that's the disk, not a hang.
- **e2e isn't isolated yet.** The API URL (`localhost:4000`) and the web port (`5173`) are fixed, Playwright reuses a running server, and the e2e signs up its users in the running API's **dev database**. Run one e2e at a time per machine, and know which database it writes to.
- **The Playwright config asks for Edge** (`channel: "msedge"`). On a machine with only Chrome, e2e won't start.
- **CI and deploys:** every pull request runs `.github/workflows/ci.yml` (API build and vitest, the migrations-build-the-schema check, client `tsc --noEmit`, both i18n checks, vitest and build). **A push to `main` deploys** to the VPS while the repository variable `DEPLOY_ENABLED` is `true`; the runbook is `deploy/README.md`. A new `api/.env` line goes onto the box by hand before the push that needs it.
- **After a schema change:** `npx prisma migrate dev --name <change>`, then update `01-data-model.md` and add a migration note to root-sot's `tracker/decisions/decision-log.md` (convention 12).

## Easy to get wrong

- **Dates:** what a person reads goes through `useAppDate`; what crosses the wire goes through `~/utils/dateUtils`, Gregorian only. `date-fns-jalali`'s `format` returns a valid-looking date fourteen centuries out, and TypeScript can't tell the two apart.
- **Digits are Western in both locales.**
- **Persian word boundaries are not `\b`:** use Unicode property escapes with the `u` flag.
- **Every user-facing string** is a key in both `en` and `fa` `common.json`. The Persian is informal and uses the conventions file's glossary.
- **Logic is tested in API integration tests.** Client tests mock `useApi` and stay thin.

## Git

- **Never `git add -A` or `git add .`.** Add files by name.
- Check `git config user.email` before the first commit. No secrets, tokens, `.env` files or personal data: the repo is public.
- `.tmp/` is for lane reports and suite logs, and is never committed.
