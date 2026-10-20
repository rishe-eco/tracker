# Deploying Tracker to the VPS

The runbook. Tracker shares the box with root-app, IMNSTR and others, and is
served at `https://tracker.m-root.com`.

```
browser ──TLS──▶ host Nginx ──┬──▶ /opt/stacks/tracker/current        (static files: a release)
                              └──▶ 127.0.0.1:4000  (container api-api-1) ──▶ api/data/prod.db
```

**The API** runs in Docker, built on the box from `api/Dockerfile`
(`node:24-alpine`). The container runs `prisma migrate deploy` every time it
starts, then the server. A failed migration means it never listens, which is
the intent: an API running against a schema it doesn't expect is worse than
one that is down. **The web app** is built elsewhere (by CI, or on your
machine) and served by host Nginx off disk. The box has no Node, and
`vite build` is the step most likely to exhaust its memory.

One origin: `client/.env.production` sets `VITE_API_URL="/graphql"`, and
Nginx proxies `/graphql` to the container.

---

## Server layout

| | |
|---|---|
| Checkout | `/opt/stacks/tracker`, a clone of `main`, owned by **root**. `git` there needs `sudo`. It is **sparse**: only `api/` and `client/` are on disk, so `deploy/` is read from the commit with `git show` |
| API | `api/docker-compose.yml`, run from `/opt/stacks/tracker/api`. The project name comes from the directory, `api`, so the container is `api-api-1`, on `127.0.0.1:4000` |
| API environment | `/opt/stacks/tracker/api/.env` (`JWT_SECRET`, `CORS_ORIGINS`, the Anthropic key), read by Compose. `DATABASE_URL` is not in it: the compose file sets it to `file:/app/data/prod.db` |
| Database | `/opt/stacks/tracker/api/data/prod.db`, the container's `/app/data`. Pre-migration backups are in `api/data/backups/` |
| Web | `/opt/stacks/tracker/releases/<UTC stamp>-<short sha>/`, with `/opt/stacks/tracker/current` linking to the live one. Nginx's `root` is `current` |
| Nginx site | the one file under `/etc/nginx/sites-enabled/` naming the domain: `grep -Rl tracker.m-root.com /etc/nginx/sites-enabled/` (`-R`, because those are links) |

`api/.env`, `api/data/`, `releases/` and `current` are untracked, and git
ignores them, so the checkout stays clean.

---

## Routine deploys

**A push to `main` deploys**, once *Server setup for CI* (below) is done.

1. **`check`** (`.github/workflows/ci.yml`, the same jobs every pull request
   runs). API: `npm ci`, `prisma generate`, a check that the migrations build
   `schema.prisma`, the `tsc` build, and vitest. Client:
   `npm ci --legacy-peer-deps`, `npx tsc --noEmit`, both `i18n:check-*`
   scripts, vitest and the build. Deploy script: shellcheck, and its own harness
   (`deploy/test/tracker-deploy.test.sh`). There is no Playwright: e2e stays on
   your machine.
2. If that is green, **`deploy`** (`.github/workflows/deploy.yml`) builds the
   client on the runner, packs it with the commit's id, and sends it as the
   input of one SSH connection to the box as `tracker-deploy`. That key can only
   run `/usr/local/sbin/tracker-deploy`, as root through `sudo`, with no
   arguments. The job runs only for `main`, and only while the repository
   variable `DEPLOY_ENABLED` is `true`. Any other value switches automatic
   deploys off, and `check` still runs.
3. The script deploys **exactly that commit**, never a newer tip of `main`, so
   the API and the web always come from one commit. It fast-forwards
   `/opt/stacks/tracker` to it. If the commit adds a migration, it backs up the
   database first. Then it builds the API image, runs `docker compose up -d`,
   and waits up to 120 s for the API to answer. It runs `nginx -t`, makes the
   web build live by swapping `current`, and runs `deploy/checks.sh` as
   `nobody`. A green run ends with `DEPLOYED <sha>`, and the job fails unless
   that is the pushed commit.

**The script never changes Nginx, the compose file, `.env` or itself.** If
`api/docker-compose.yml` or `api/.env.example` changed since the commit the box
has, or `deploy/tracker-deploy.sh` differs from the installed copy, it stops
before it changes anything and exits 2 (*What each exit code means*). It never
reloads Nginx, never prunes images and never rolls back. Any other one-off
server step (a new `.env` line for a feature, a certificate) is still yours, by
hand, **before** the push that needs it.

The repository is public, and so is the Actions log. Nothing in the workflow or
the script prints a secret or a line of `.env`.

### Deploying by hand

The fallback when CI is off or red, and the way through a stop (exit 2).

**Web**, built on your machine from a clean `main`:

```bash
(cd client && npm ci --legacy-peer-deps && npm run build)
echo "$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=7 HEAD)"
tar -czf web.tgz -C client/dist .
scp web.tgz you@your-vps:/tmp/tracker-web.tgz
```

Then, on the box, with `<name>` being the line the `echo` printed:

```bash
sudo mkdir /opt/stacks/tracker/releases/<name>
sudo tar -xzf /tmp/tracker-web.tgz --no-same-owner -C /opt/stacks/tracker/releases/<name>
cd /opt/stacks/tracker && sudo ln -sfn releases/<name> .current.tmp && sudo mv -T .current.tmp current
rm /tmp/tracker-web.tgz
```

**API**, on the box:

```bash
cd /opt/stacks/tracker && sudo git pull --ff-only
cd api && sudo docker compose up -d --build
sudo docker compose logs -f api
```

A by-hand deploy takes no backup. When the commit adds a migration, take one
first (*Backups*).

After a by-hand step, **Run workflow** on the repository's Actions page (the
`deploy` workflow, branch `main`). That deploys the tip of `main` through CI.
The checkout is already current, so the stop files no longer differ, the image
builds from cache, and the run ends with every check passed.

### What each exit code means

| Exit | Meaning | What to do |
|---|---|---|
| **0** | Deployed, and every check passed. The last line is `DEPLOYED <sha>`. | Nothing. |
| **2** | **Stopped, and nothing was changed.** The API and the live web release are as they were. The line says why, and the line after it says what to do by hand. | The list below, then **Run workflow**. |
| **1** | **Failed after something may have changed.** The line names the step: `checkout`, `backup`, `build`, `up`, `health`, `nginx`, `web` or `checks`. There is no automatic rollback, because migrations run at boot and old code against a migrated database is the riskier move. | Read the step's output, fix forward on `main`, or roll back by hand (below). A failed `backup` or `build` leaves the old container serving, and every failure before `web` leaves the old web release live. |

What to do for each exit 2:

- **Another deploy holds the lock.** Wait for it, then re-run.
- **No web build on stdin.** The script was run from a shell. It only takes
  input from CI: use **Run workflow**, or deploy by hand.
- **The stream is not a gzipped tar, or its `COMMIT` is wrong.** Re-run. If it
  repeats, read the job's *Package the web build* step.
- **The checkout has uncommitted changes.** `sudo git -C /opt/stacks/tracker
  status` shows them. Commit, stash or discard them, then re-run.
- **The commit is not on `main`.** Only `main` deploys.
- **The commit is older than the checkout.** An old run was re-run, or the
  checkout was moved by hand. Use **Run workflow**. To go back on purpose, see
  *Rolling back by hand*.
- **Not a fast-forward** (history was rewritten). The script never resets the
  checkout. Compare `git log` in `/opt/stacks/tracker` with `main` and decide
  there.
- **`api/docker-compose.yml` changed.** See the change with
  `cd /opt/stacks/tracker && sudo git fetch && sudo git diff HEAD origin/main -- api/docker-compose.yml`,
  deploy the API by hand (above), then **Run workflow**.
- **`api/.env.example` changed.** Read the diff the same way, add what the new
  lines need to `/opt/stacks/tracker/api/.env`, then `sudo git pull --ff-only`,
  then **Run workflow**.
- **The installed script differs from the commit's.** Reinstall it from the
  fetched `main` (*Server setup for CI*, steps 1 and 6), then **Run workflow**.
  Don't pull: the run moves the checkout, and a pull would hide a migration
  from the backup step.

Each of these names everything it found in one run, so fix all of them before
re-running.

### Rolling back by hand

**Web**: the previous releases are still on disk (five, plus the live one):

```bash
ls /opt/stacks/tracker/releases/
cd /opt/stacks/tracker && sudo ln -sfn releases/<name> .current.tmp && sudo mv -T .current.tmp current
```

No Nginx reload is needed, because Nginx resolves the root per request.

**API**: roll it back only when the bad commit added no migration
(`git diff --stat <good>..HEAD -- api/prisma/migrations` prints nothing),
because a migrated database under old code is worse than the bug. If it did add
one, fix forward. The backup taken before that migration is
`/opt/stacks/tracker/api/data/backups/pre-migrate-<stamp>-<sha>.db` (root only;
the newest five are kept).

1. In GitHub, **Settings, Secrets and variables, Actions, Variables**: set
   `DEPLOY_ENABLED` to `false`, so a push can't redeploy the bad commit while
   you work.
2. On the box, check out the last good commit and rebuild:
   ```bash
   cd /opt/stacks/tracker && sudo git checkout --detach <good sha>
   cd api && sudo docker compose up -d --build
   ```
   Roll the web back to that commit's release too (above).
3. Revert the bad commit on `main`. On the box, run `sudo git checkout main`
   in `/opt/stacks/tracker`, then set `DEPLOY_ENABLED` back to `true`. The next
   push deploys the revert.

### Checks after every deploy

`deploy/checks.sh` is the one list. The deploy script runs it as `nobody` from
the new checkout, so a change that adds a check edits that file in its own
diff, and nobody reinstalls the root script. By hand, on the box:

```bash
sudo git -C /opt/stacks/tracker show HEAD:deploy/checks.sh | sudo runuser -u nobody -- bash -s /opt/stacks/tracker/current
```

The checkout is sparse, so `deploy/` isn't on disk there; the file is read from
the commit.

An optional second argument is the origin (default
`https://tracker.m-root.com`). It stops at the first failure and prints
`FAILED <check name>: <why>`. It never reads `.env`. It checks that:

- `/` serves the live release's `index.html` byte for byte. A Nginx `root`
  that isn't `current` fails here;
- a client-side route (`/goals`) falls back to the same page;
- the script `index.html` names, `manifest.webmanifest` and `sw.js` are the
  release's own files, so an installed PWA updates to the new release;
- `/graphql` answers an anonymous `{ __typename }` through Nginx;
- `http://` redirects to `https://` with a 301.

The checks that need root stay in the script: the API answering on
`127.0.0.1:4000` with its container still running, and `nginx -t`.

---

## Server setup for CI

You do this once, as your sudo user (`deploy`), one command per line.
**`tracker-deploy` is a separate account from your own `deploy` user, from
root-app's `root-deploy` and from IMNSTR's `imnstr-deploy`. Never give CI's key
to any of them.**

**Leave the checkout where it is** (at `003db5a` on 2026-10-21). The first CI
run fast-forwards it, and because that run brings the Focus Periods migration
(`add_focus_periods`), it backs up the database before the container applies it.
If you `git pull` by hand first, the run sees no migration between the checkout
and the commit, and takes no backup.

1. **Fetch `main`** without moving the checkout, so the new files can be read
   from it:
   ```bash
   sudo git -C /opt/stacks/tracker fetch origin main
   ```

2. **Make the live web build the first release, and point Nginx at it.** Find
   the site file and its current `root`:
   ```bash
   grep -Rl tracker.m-root.com /etc/nginx/sites-enabled/
   grep -n -E '^\s*(root|server_name)' /etc/nginx/sites-available/<that file>
   ```
   Copy what that `root` serves into a release, and link it as `current`:
   ```bash
   sudo mkdir -p /opt/stacks/tracker/releases
   sudo cp -a <the root directory>/. /opt/stacks/tracker/releases/20261021000000-003db5a
   cd /opt/stacks/tracker && sudo ln -sfn releases/20261021000000-003db5a current
   ```
   Keep a copy of the site file (`sudo cp <file> ~/tracker-nginx.bak`), change
   its `root` line to `root /opt/stacks/tracker/current;`, then:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo nginx -T 2>/dev/null | grep -E '^\s*(server_name|root)\s'
   sudo git -C /opt/stacks/tracker show FETCH_HEAD:deploy/checks.sh | sudo runuser -u nobody -- bash -s /opt/stacks/tracker/current
   ```
   In the `nginx -T` output, every `root` line after `server_name
   tracker.m-root.com` must read `root /opt/stacks/tracker/current;`. **That
   line is the only proof of the switch.** The checks pass either way here,
   because the first release is a copy of the old root. The last line ends
   `checks passed`. The site is unchanged; only its path is new.

3. **The key pair, on your own machine, never on the box and never in the
   repository.** It has no passphrase, because CI cannot type one:
   ```bash
   ssh-keygen -t ed25519 -N '' -C tracker-ci -f ./tracker-ci-key
   ```
   `tracker-ci-key.pub` is the public half, one line. `tracker-ci-key` is the
   private half. Both are deleted at step 10.

4. **The user**: no password, `/bin/sh` as its shell (`sshd` runs the forced
   command through the user's shell, so `nologin` would block it), and no group
   but its own:
   ```bash
   sudo adduser --disabled-password --gecos '' --shell /bin/sh tracker-deploy
   ```
   If a login later says the account is locked, `sudo usermod -p '*'
   tracker-deploy` makes the password unusable without locking the account.

5. **The key's line**, with the forced command. Paste the public key where
   `<public key>` is, keeping the single quotes. The directory and the file
   belong to root, so the user cannot rewrite its own line:
   ```bash
   sudo install -d -m 0755 -o root -g root /home/tracker-deploy/.ssh
   printf '%s\n' 'restrict,command="sudo -n /usr/local/sbin/tracker-deploy" <public key>' | sudo tee /home/tracker-deploy/.ssh/authorized_keys
   sudo chmod 0644 /home/tracker-deploy/.ssh/authorized_keys
   ```
   The line must read `restrict,command="sudo -n /usr/local/sbin/tracker-deploy"
   ssh-ed25519 AAAA… tracker-ci`. `restrict` gives no pty, no forwarding and no
   agent. Any command the client sends runs the script and nothing else.

6. **The script**, from the fetched `main`:
   ```bash
   sudo git -C /opt/stacks/tracker show FETCH_HEAD:deploy/tracker-deploy.sh | sudo tee /usr/local/sbin/tracker-deploy >/dev/null
   sudo chown root:root /usr/local/sbin/tracker-deploy
   sudo chmod 0755 /usr/local/sbin/tracker-deploy
   ```
   Later, to reinstall it after a change (exit 2 says when): the `fetch` from
   step 1, then these same three lines. The checkout is sparse, so the file
   isn't on disk there.

7. **The sudoers line.** A broken file in `/etc/sudoers.d/` breaks `sudo` for
   everyone on the box, so write it to a temporary file, check it with
   `visudo -cf`, and only then install it. The name has no dot, because `sudo`
   skips names with one. The empty `""` forbids arguments:
   ```bash
   F=$(mktemp /tmp/tracker-deploy.XXXXXX)
   printf 'tracker-deploy ALL=(root) NOPASSWD: /usr/local/sbin/tracker-deploy ""\n' > "$F"
   sudo visudo -cf "$F"
   ```
   Only if the last command printed `parsed OK`:
   ```bash
   sudo install -m 0440 -o root -g root "$F" /etc/sudoers.d/tracker-deploy
   rm "$F"
   sudo -n true
   ```
   The last line proves your own `sudo` still works.

8. **Prove the account.** `id` shows no `docker` group, `sudo -l` lists the one
   command with `""`, and the third command is refused:
   ```bash
   id tracker-deploy
   sudo -l -U tracker-deploy
   sudo -u tracker-deploy docker ps
   ```

9. **On GitHub (web)**, in `rishe-eco/tracker`. Settings, **Environments**,
   **New environment** `production`. Deployment branches: `main` only; no
   reviewers and no wait timer, since either would make every deploy wait for a
   click. Add four **environment secrets**:

   | Secret | Value |
   |---|---|
   | `DEPLOY_HOST` | the box's hostname or address, the one you SSH to (the same box as root-app) |
   | `DEPLOY_PORT` | the box's SSH port, `22` unless you changed it |
   | `DEPLOY_KEY` | the whole private key file `tracker-ci-key`, including its `-----BEGIN` and `-----END` lines |
   | `DEPLOY_KNOWN_HOSTS` | one line, the box's own host key. Make it on the box, with the same name or address as `DEPLOY_HOST` in place of `<host>`: `echo "<host> $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"` |

   Then, under Settings, **Secrets and variables, Actions, Variables**, add the
   variable `DEPLOY_ENABLED` = `true` under *Repository variables*. **Set it
   last.** Anything but `true` switches automatic deploys off. **Don't make it
   an environment variable of `production`:** GitHub decides whether to run a
   job before it loads the job's environment, so the `deploy` job's `if` can't
   see one there, and every run shows `deploy` as skipped (found on IMNSTR).

   Nothing else goes into GitHub. `JWT_SECRET`, `CORS_ORIGINS` and the
   Anthropic key stay in `/opt/stacks/tracker/api/.env` on the box, and CI's
   tests need none of them.

10. **Delete the private half** once it is pasted into `DEPLOY_KEY`, on your
    own machine:
    ```bash
    rm tracker-ci-key tracker-ci-key.pub
    ```
    (`Remove-Item` in PowerShell.) GitHub keeps the secret, and nobody can read
    it back.

11. **Run workflow** (Actions, `deploy`, branch `main`). The log shows
    `database backed up to …/pre-migrate-…`, `checkout moved: 003db5a… -> …`, the
    image build, `API answers on http://127.0.0.1:4000/graphql`, `web live:
    releases/…` and `checks passed`, and ends `DEPLOYED <sha>` equal to the
    pushed commit. Focus Periods is then live. From here on, every push to
    `main` deploys.

If a run cannot connect, either the provider's firewall limits SSH by address
(hosted runners come from a wide, changing range) or the key line is wrong.
`sudo journalctl -u ssh --since '10 minutes ago'` on the box says which. If
`AllowUsers` or `AllowGroups` is ever added to `sshd_config`, add
`tracker-deploy` to it, then `sudo sshd -t && sudo systemctl reload ssh`.

The script is tested without a box by `deploy/test/tracker-deploy.test.sh`
(stubbed Docker, Nginx and curl, a scratch origin and checkout). It needs
Linux. On Windows, run it in a container:

```bash
docker run --rm -v "$PWD:/src:ro" -w /src buildpack-deps:bookworm-scm bash deploy/test/tracker-deploy.test.sh
```

---

## Backups

**Before a migration**, the deploy script takes one. It runs SQLite's
`VACUUM INTO` inside the running container, through the container's own Prisma
client, which gives a consistent copy even while the API writes. The copy is
`/opt/stacks/tracker/api/data/backups/pre-migrate-<stamp>-<sha>.db`, mode 0600,
in a 0700 directory, and the newest five are kept. The same, by hand:

```bash
cd /opt/stacks/tracker/api && sudo mkdir -p -m 0700 data/backups
sudo docker compose exec -T -e TRACKER_BACKUP=/app/data/backups/by-hand-$(date -u +%Y%m%d%H%M%S).db api node -e 'const { PrismaClient } = require("@prisma/client"); const p = new PrismaClient(); p.$executeRawUnsafe("VACUUM INTO '"'"'" + process.env.TRACKER_BACKUP + "'"'"'").then(() => p.$disconnect()).catch((e) => { console.error(e.message); process.exit(1); });'
```

To restore one: stop the container (`sudo docker compose stop api`), copy the
backup over `data/prod.db`, remove any `prod.db-wal` and `prod.db-shm` beside
it, then `sudo docker compose up -d api`.

**Nothing is copied off the box.** A backup on the same disk as the database
doesn't survive losing the disk. Put a copy somewhere else, and restore it once
to prove it's real.
