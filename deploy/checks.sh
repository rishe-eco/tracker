#!/usr/bin/env bash
# The checks after every deploy: the one list. Run by tracker-deploy as an unprivileged user from
# the new checkout, and by hand from the box:
#
#   bash deploy/checks.sh <live web dir> [origin]
#   bash /opt/stacks/tracker/deploy/checks.sh /opt/stacks/tracker/current
#
# A change that adds a deploy check adds it here, in its own diff, so nobody reinstalls the
# root-owned script to get it. It needs only bash, curl, grep, sed, tr and cmp, and it never reads
# the server's .env. It stops at the first failure and names the check by function, so the
# Actions log (which is public) says which one.
#
# Everything it sends is a GET, except one anonymous `{ __typename }` POST to /graphql, which
# reads nothing and writes nothing.
set -uo pipefail

LIVE="${1:-}"
ORIGIN="${2:-https://tracker.m-root.com}"

if [ -z "$LIVE" ] || [ ! -f "$LIVE/index.html" ]; then
  echo "usage: checks.sh <live web dir, holding index.html> [origin]" >&2
  exit 64
fi

HOST="${ORIGIN#https://}"
MAX_TIME=20

# ── Helpers ──

CHECK=""
fail() {
  echo "FAILED $CHECK: $*"
  exit 1
}

# The last response: the body to a file (compared byte for byte), the headers to a variable with
# the carriage returns removed. Plain variables and here-strings, never a pipe into "grep -q":
# under pipefail, grep quitting on its first match would kill the writer with SIGPIPE and fail the
# check for nothing.
HEADERS=""
BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT

fetch() {
  HEADERS=$(curl -s --max-time "$MAX_TIME" -D - -o "$BODY_FILE" "$@" | tr -d '\r') || fail "no answer from $*"
  [ -n "$HEADERS" ] || fail "empty answer from $*"
}

status_of() { sed -n '1s/^HTTP\/[0-9.]* \([0-9][0-9]*\).*$/\1/p' <<<"$HEADERS"; }

# header <name>: the first value, or nothing. The name is matched case-insensitively.
header() { sed -n "/^$1:/I{s/^[^:]*:[[:space:]]*//;p;q}" <<<"$HEADERS"; }

expect_status() {
  local got
  got=$(status_of)
  [ "$got" = "$1" ] || fail "expected status $1, got '${got:-none}'"
}

expect_header() {
  local got
  got=$(header "$1")
  [ "$got" = "$2" ] || fail "header $1 is '${got:-absent}', expected '$2'"
}

# expect_release_file <path>: the origin serves the release's own copy of <path>, byte for byte.
expect_release_file() {
  fetch "$ORIGIN$1"
  expect_status 200
  cmp -s "$BODY_FILE" "$LIVE$1" || fail "$1 is not the release's own file (is Nginx's root $LIVE?)"
}

# ── The checks ──

# The site's root serves the release that was just made live, byte for byte.
check_index_is_the_new_release() {
  CHECK=${FUNCNAME[0]}
  fetch "$ORIGIN/"
  expect_status 200
  cmp -s "$BODY_FILE" "$LIVE/index.html" || fail "/ is not $LIVE/index.html (is Nginx's root $LIVE?)"
}

# A client-side route falls back to the same index.html.
check_deep_link_falls_back() {
  CHECK=${FUNCNAME[0]}
  fetch "$ORIGIN/goals"
  expect_status 200
  cmp -s "$BODY_FILE" "$LIVE/index.html" || fail "/goals is not the SPA's index.html"
}

# The script the index names is served from the release.
check_asset_is_served() {
  CHECK=${FUNCNAME[0]}
  local asset
  asset=$(grep -o '/assets/[^"]*\.js' "$LIVE/index.html" | head -n 1)
  [ -n "$asset" ] || fail "$LIVE/index.html names no /assets/*.js"
  expect_release_file "$asset"
}

# The PWA's manifest and service worker come from the release, so an installed app updates to it.
check_pwa_files_are_served() {
  CHECK=${FUNCNAME[0]}
  local file
  for file in /manifest.webmanifest /sw.js; do
    [ -f "$LIVE$file" ] || fail "the release has no $file"
    expect_release_file "$file"
  done
}

# The API answers through Nginx, on the same origin.
check_graphql_answers() {
  CHECK=${FUNCNAME[0]}
  fetch -X POST -H 'Content-Type: application/json' --data '{"query":"{ __typename }"}' "$ORIGIN/graphql"
  expect_status 200
  grep -qF '"__typename":"Query"' "$BODY_FILE" || fail "the body is not { __typename: Query }"
}

# Plain HTTP goes to HTTPS.
check_http_redirects() {
  CHECK=${FUNCNAME[0]}
  fetch "http://$HOST/"
  expect_status 301
  expect_header location "https://$HOST/"
}

check_index_is_the_new_release
check_deep_link_falls_back
check_asset_is_served
check_pwa_files_are_served
check_graphql_answers
check_http_redirects
echo "checks passed: $ORIGIN serves $(basename "$(readlink -f "$LIVE")")"
