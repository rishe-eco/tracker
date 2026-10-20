#!/usr/bin/env bash
# The reference copy of /usr/local/sbin/tracker-deploy: the one script CI's deploy user may run, as
# root, through sudo, with no arguments. A push to main reaches it over SSH (deploy/README.md,
# "Server setup for CI").
#
# Its input is the web build, on stdin: a gzipped tar holding `COMMIT` (the 40-hex commit the
# runner built) and `web/` (that commit's client/dist). The runner builds the client because the
# box has no Node, and `vite build` is the step most likely to exhaust its memory. The box then
# deploys exactly that commit, never a newer tip, so the API and the web always come from one
# commit:
#
#   read the stream into releases/.incoming-*, fast-forward the checkout to COMMIT, back up the
#   database if the commit adds a migration, build the API image here, `up -d`, wait for the API
#   to answer, `nginx -t`, swap `current` to the new release, then run deploy/checks.sh as an
#   unprivileged user.
#
# It never changes Nginx, the compose file, .env or itself. If the compose file, .env.example or
# this script changed it stops before it changes anything, and the founder does that part by hand
# (deploy/README.md).
#
# Exit codes
#   0  deployed, every check passed
#   2  stopped, and nothing was changed: the lock is held, no build came in, the tree is dirty,
#      the commit is not on main or is older than the checkout, or a file this script never
#      installs changed (README: "What each exit code means")
#   1  failed after the checkout or the container may have changed; the site is left as it is
#      (no rollback: migrations run at boot, so old code against a migrated database is worse)
#
# Nothing here prints a secret, because the log of the run is public. It never sources .env, never
# prints a line of it, and never traces its commands.
set -euo pipefail

# ── Overrides, for the test harness only ──
# Every path and command the script takes from its environment is in this block. On the box
# sudo's env_reset strips the deploy user's environment, so none of these can be set from outside
# the SSH session; the defaults below are what runs there.
ROOT="${TRACKER_ROOT:-/opt/stacks/tracker}"
REPO_URL="${TRACKER_REPO_URL:-https://github.com/rishe-eco/tracker.git}"
LOCK="${TRACKER_LOCK:-/run/tracker-deploy.lock}"
INSTALLED="${TRACKER_INSTALLED:-/usr/local/sbin/tracker-deploy}"
API_URL="${TRACKER_API_URL:-http://127.0.0.1:4000/graphql}"
HEALTH_WAIT="${TRACKER_HEALTH_WAIT:-120}"
CHECK_USER="${TRACKER_CHECK_USER:-nobody}"
FLOCK="${TRACKER_FLOCK:-flock}"
DOCKER="${TRACKER_DOCKER:-docker}"
NGINX="${TRACKER_NGINX:-nginx}"
CURL="${TRACKER_CURL:-curl}"
RUNUSER="${TRACKER_RUNUSER:-runuser}"
BASH_BIN="${TRACKER_BASH:-bash}"
# ── end of overrides ──

# The checkout is the app root: api/ and client/ are in it, and releases/, current and
# api/data/ sit beside the tracked files, ignored by git.
DIR="$ROOT"
API="$DIR/api"
# The project name comes from the directory, `api`, so the container stays `api-api-1`.
COMPOSE=(-f docker-compose.yml)
# The compose file mounts ./data at /app/data; backups go under it, so the container can write them.
BACKUPS="$API/data/backups"
BACKUPS_IN_CONTAINER=/app/data/backups
KEEP_RELEASES=5   # old web releases kept, plus the live one
KEEP_BACKUPS=5    # pre-migration backups kept
MAX_STREAM=200M   # a web build is a few MB; anything near this is not one
# Compose and git never ask a question: a prompt would hang a job with no terminal.
export GIT_TERMINAL_PROMPT=0

die() {
  echo "FAILED (exit 1): $1" >&2
  exit 1
}

halt() {
  echo "STOP (exit 2, nothing changed): $1"
  echo "  By hand: $2"
  exit 2
}

# prune <dir> <keep> <pattern> <spare> <remove command...>: removes all but the newest <keep> names
# matching <pattern>, never <spare>. Names start with a UTC stamp, so sorting them sorts by age, and
# a dot name (an incoming build) never matches. Process substitution, so finding nothing to prune
# is not a failure under pipefail.
prune() {
  local dir=$1 keep=$2 pattern=$3 spare=$4 names i
  shift 4
  mapfile -t names < <(find "$dir" -mindepth 1 -maxdepth 1 -printf '%f\n' | grep -E "$pattern" | grep -vxF -- "${spare:-/}" | sort)
  for ((i = 0; i < ${#names[@]} - keep; i++)); do
    "$@" "$dir/${names[i]}"
  done
}

# compose <args...>: docker compose, from api/, where the compose file and its .env are.
compose() { (cd "$API" && "$DOCKER" compose "${COMPOSE[@]}" "$@"); }

# api_answers: the API answers an anonymous `{ __typename }`, which reads nothing and writes nothing.
api_answers() {
  local body
  body=$("$CURL" -s --max-time 5 -X POST -H 'Content-Type: application/json' \
    --data '{"query":"{ __typename }"}' "$API_URL" 2>/dev/null) || return 1
  case "$body" in *'"__typename":"Query"'*) return 0 ;; *) return 1 ;; esac
}

# ── 1. The lock ──
# One deploy at a time. The file is in /run, which only root can write, not in the world-writable
# /run/lock, where another account on this shared box could plant it first and hold it.
exec 9>"$LOCK"
if ! "$FLOCK" -n 9; then
  halt "another deploy holds $LOCK" "wait for it to finish, then re-run the job"
fi

# git refuses a repository another user owns, so git and tar run as the account that owns the
# checkout (root, on this box, today), with that account's own HOME.
OWNER=$(stat -c %U "$DIR") || halt "no checkout at $DIR" "clone it (README, Server layout)"
OWNER_HOME=$(getent passwd "$OWNER" | cut -d: -f6)
as_owner() { "$RUNUSER" -u "$OWNER" -- env HOME="${OWNER_HOME:-/nonexistent}" "$@"; }
git_() { as_owner git -C "$DIR" "$@"; }

# ── 2. The web build, from stdin ──
# Read whole before anything else, so a half-sent stream changes nothing. It lands under releases/
# with a dot name, which nothing serves and the prune below never matches.
if [ -t 0 ]; then
  halt "no web build on stdin (this script is run by CI, which sends one)" \
    "re-run the job on GitHub (Actions, Run workflow); to deploy without CI, see README, Deploying by hand"
fi
as_owner mkdir -p "$ROOT/releases"
INCOMING=$(as_owner mktemp -d "$ROOT/releases/.incoming-XXXXXX")
trap 'rm -rf "$INCOMING"' EXIT
head -c "$MAX_STREAM" | as_owner tar -xzf - --no-same-owner --no-same-permissions -C "$INCOMING" \
  || halt "the web build on stdin is not a gzipped tar" "re-run the job; if it repeats, read the job's Deploy step"
[ -z "$(head -c 1)" ] || halt "the web build on stdin is over $MAX_STREAM" "read the job's build step"

SHA=$(tr -d '\n' < "$INCOMING/COMMIT" 2>/dev/null || true)
case "$SHA" in
  *[!0-9a-f]* | "") halt "the stream's COMMIT is missing or not a commit id" "re-run the job" ;;
esac
[ "${#SHA}" = 40 ] || halt "the stream's COMMIT is not a full 40-hex commit id" "re-run the job"
[ -f "$INCOMING/web/index.html" ] || halt "the stream has no web/index.html" "read the job's build step"
SHORT=${SHA:0:7}
echo "web build for $SHA received"

# ── 3. A clean tree ──
# Untracked files (api/.env, api/data/, releases/) are ignored on purpose: they are not the
# repository's, and a merge that would overwrite one refuses on its own.
if [ -n "$(git_ status --porcelain --untracked-files=no)" ]; then
  halt "the checkout in $DIR has uncommitted changes" \
    "look at \`sudo git -C $DIR status\`, then commit, stash or discard them, and re-run the job"
fi

# ── 4. Fetch, and place the commit ──
# Anonymous HTTPS by URL, so the clone's own remote (and whatever key it needs) is never used.
git_ fetch --quiet "$REPO_URL" main \
  || halt "git fetch $REPO_URL main failed" "check the box's network, then re-run the job"
TIP=$(git_ rev-parse 'FETCH_HEAD^{commit}')
OLD=$(git_ rev-parse HEAD)
if ! { git_ cat-file -e "$SHA^{commit}" 2>/dev/null && git_ merge-base --is-ancestor "$SHA" "$TIP"; }; then
  halt "$SHA is not on main" "only main deploys; re-run the job from main"
fi
if ! git_ merge-base --is-ancestor "$OLD" "$SHA"; then
  if git_ merge-base --is-ancestor "$SHA" "$OLD"; then
    halt "$SHA is older than the checkout's $OLD (a re-run of an old job)" \
      "re-run the newest job, or Run workflow on main; to go back, see README, Rolling back by hand"
  fi
  halt "$SHA is not a fast-forward of the checkout's $OLD (history was rewritten, or the checkout moved by hand)" \
    "look at \`git log\` in $DIR against main, and decide there"
fi

# ── 5. The files this script never changes ──
# Each is compared between what is checked out and the commit, so a by-hand step that also pulls
# (README, What each exit code means) makes the re-run pass.
STOPPED=""
note() { STOPPED="$STOPPED"$'\n'"STOP (exit 2, nothing changed): $1"$'\n'"  By hand: $2"; }
git_ diff --quiet "$OLD" "$SHA" -- api/docker-compose.yml \
  || note "api/docker-compose.yml changed between $OLD and $SHA" \
    "deploy the API by hand (README, Deploying by hand), then re-run the job"
git_ diff --quiet "$OLD" "$SHA" -- api/.env.example \
  || note "api/.env.example changed between $OLD and $SHA" \
    "add what the new lines need to $API/.env, pull the checkout, then re-run the job"
git_ show "$SHA:deploy/tracker-deploy.sh" | cmp -s - "$INSTALLED" \
  || note "deploy/tracker-deploy.sh in $SHA differs from the installed $INSTALLED" \
    "pull the checkout, reinstall the script (README, Server setup for CI, step 5), then re-run the job"
if [ -n "$STOPPED" ]; then
  echo "${STOPPED#$'\n'}"
  exit 2
fi

# ── 6. Move the checkout ──
# Already there (a re-run): the rest still runs. The build is cached and `up -d` changes nothing,
# so a re-run gives a verdict on what is running, and an earlier failed build can't pass for a
# deploy.
if [ "$OLD" != "$SHA" ]; then
  git_ merge --quiet --ff-only "$SHA" || die "step checkout: git merge --ff-only $SHA"
  echo "checkout moved: $OLD -> $SHA"
else
  echo "checkout already at $SHA"
fi

# ── 7. A backup, when the commit brings a migration ──
# The container runs `prisma migrate deploy` at boot and there is no going back after. The running
# container takes the copy with SQLite's VACUUM INTO, through its own Prisma client and its own
# DATABASE_URL, so this script never learns where the database is and the box needs no sqlite3.
# The copy is consistent even while the API is writing.
if ! git_ diff --quiet "$OLD" "$SHA" -- api/prisma/migrations; then
  mkdir -p "$BACKUPS" && chmod 0700 "$BACKUPS"
  NAME="pre-migrate-$(date -u +%Y%m%d%H%M%S)-$SHORT.db"
  # The name is only digits, letters and dashes, so it is safe inside the SQL string.
  # shellcheck disable=SC2016 # the JavaScript is the container's, not this shell's
  compose exec -T -e TRACKER_BACKUP="$BACKUPS_IN_CONTAINER/$NAME" api node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    prisma.$executeRawUnsafe("VACUUM INTO '"'"'" + process.env.TRACKER_BACKUP + "'"'"'")
      .then(() => prisma.$disconnect())
      .catch((e) => { console.error(e.message); process.exit(1); });' \
    || { rm -f "$BACKUPS/$NAME"; die "step backup: VACUUM INTO before the migration failed; nothing was built"; }
  [ -s "$BACKUPS/$NAME" ] || { rm -f "$BACKUPS/$NAME"; die "step backup: the pre-migration backup is empty or missing; nothing was built"; }
  chmod 0600 "$BACKUPS/$NAME"
  echo "database backed up to $BACKUPS/$NAME"
  prune "$BACKUPS" "$KEEP_BACKUPS" '^pre-migrate-' "" rm -f
fi

# ── 8. Build ──
# A failed build leaves the running container untouched: nothing is stopped before it succeeds.
compose build api || die "step build: docker compose build failed; the old container keeps serving"

# ── 9. Up ──
compose up -d api || die "step up: docker compose up -d failed (\`docker compose logs api\` in $API says why)"

# ── 10. Health, then Nginx ──
# The compose file has no healthcheck, so the API's own answer is the health. A failed migration
# stops the container before it listens, and it restarts until it is stopped, so it never answers.
waited=0
until api_answers; do
  [ "$waited" -lt "$HEALTH_WAIT" ] \
    || die "step health: the API did not answer on $API_URL within ${HEALTH_WAIT}s (\`docker compose logs api\` in $API says why)"
  sleep 2
  waited=$((waited + 2))
done
CID=$(compose ps -q api) || die "step health: docker compose ps failed"
[ -n "$CID" ] || die "step health: no api container is running"
RUNNING=$("$DOCKER" inspect --format '{{.State.Running}}' "$CID") \
  || die "step health: docker inspect failed"
[ "$RUNNING" = true ] || die "step health: the api container answered once, then stopped running"
echo "API answers on $API_URL"
"$NGINX" -t || die "step nginx: nginx -t failed (this script only reads it, and never reloads)"

# ── 11. The web release ──
# One rename makes it live, Nginx resolves `current` per request, and the live release is never
# pruned, even after a rollback made it not the newest.
RELEASE="$(date -u +%Y%m%d%H%M%S)-$SHORT"
# Two runs within one second (a quick re-run) would share the name.
if [ -e "$ROOT/releases/$RELEASE" ]; then RELEASE="$RELEASE-$$"; fi
as_owner chmod 0755 "$INCOMING/web"
as_owner mv -T "$INCOMING/web" "$ROOT/releases/$RELEASE" || die "step web: could not place releases/$RELEASE"
as_owner ln -sfn "releases/$RELEASE" "$ROOT/.current.tmp" || die "step web: could not make the link"
as_owner mv -T "$ROOT/.current.tmp" "$ROOT/current" || die "step web: could not swap current"
echo "web live: releases/$RELEASE"
prune "$ROOT/releases" "$KEEP_RELEASES" '^[0-9]' "$(basename "$(readlink "$ROOT/current")")" as_owner rm -rf

# ── 12. The checks, as an unprivileged user ──
# Repository code runs here, so it runs without any right of its own. They live in the repo, so a
# new check needs no reinstall of this script.
"$RUNUSER" -u "$CHECK_USER" -- "$BASH_BIN" "$DIR/deploy/checks.sh" "$ROOT/current" \
  || die "step checks: deploy/checks.sh failed (see the FAILED line above); the site is left on the new release"

# ── 13. The verdict ──
echo "DEPLOYED $(git_ rev-parse HEAD)"
