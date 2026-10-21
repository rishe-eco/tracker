# e2e

Each run gets its own ports and its own scratch database, so lanes can run side by side and nothing touches a dev database or a dev server. Playwright starts both servers itself.

## Variables

| Variable | Default | Meaning |
|---|---|---|
| `E2E_API_PORT` | `4010` | API port |
| `E2E_WEB_PORT` | `5183` | web (Vite) port, `--strictPort` |
| `PW_CHANNEL` | `msedge` | browser channel; `chrome` on Linux |
| `E2E_REUSE` | unset | `1` reuses servers already running on the ports; otherwise a taken port fails the run |

The config refuses a port that isn't a whole number from 1 to 65535, the dev servers' `4000` or `5173` (with `E2E_REUSE=1` a run there would write to the dev database), or one port for both.

Per API port too: the scratch database, the credentials file, the report folders, and (per web port) the Vite dependency cache `client/node_modules/.vite-e2e-<web port>`; two Vite servers on one cache race on Windows (EPERM). The scratch database is `api/prisma/prisma/p<API port>-e2e.db` (gitignored via `*.db`), deleted with its `-wal` and `-shm` files and rebuilt on every run (`e2e/clearScratchDb.mjs`, then `prisma db push --force-reset`). The push takes 7–60 s on the Windows machine, so the API gets 5 minutes to start. The config refuses to start unless the URL ends in `e2e.db` and names no `dev.db`, `test.db` or `prod.db`. `DATABASE_URL` from your shell is never used.

## Slots

| Slot | API | Web |
|---|---|---|
| A | `4010` | `5183` |
| B | `4020` | `5193` |

```bash
cd client
E2E_API_PORT=4020 E2E_WEB_PORT=5193 npx playwright test e2e/auth.spec.ts
```

`E2E_REUSE=1` with the same ports reuses servers a previous run left up (they are not reset).

## Windows

Windows reserves port ranges that move on reboot, and a reserved port fails to bind. Check first:

```
netsh interface ipv4 show excludedportrange protocol=tcp
```

If a default falls inside a range, set both variables to ports outside it.
