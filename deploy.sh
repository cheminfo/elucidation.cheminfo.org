#!/usr/bin/env bash
# Deploy elucidation.cheminfo.org, keeping every previous image tagged so a
# rollback needs no build and no network. See README.md § Deploy and rollback.
# Only the frontend is built here; the backend services run published images.
set -euo pipefail

cd "$(dirname "$0")"

IMAGE_NAME="${IMAGE_NAME:-ghcr.io/cheminfo/elucidation-frontend}" # must match compose*.yaml
SERVICE=frontend
KEEP=10 # images kept for rollback
STATE=.deploy
HISTORY="$STATE/history"

cmd_deploy() {
  if [ "$(git rev-parse --abbrev-ref HEAD)" = "HEAD" ]; then
    echo "detached HEAD (left by a rollback) - run: git checkout main" >&2
    exit 1
  fi

  git pull --ff-only
  local tag previous
  tag="$(new_tag)"
  previous="$(current_tag || true)"

  set_env IMAGE_TAG "$tag"
  docker compose build
  docker compose up -d --remove-orphans

  if healthy; then
    printf '%s %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" "$(git rev-parse HEAD)" >>"$HISTORY"
    cmd_prune
    echo "deployed $tag"
  else
    echo "health check failed - rolling back to ${previous:-nothing}" >&2
    if [ -n "$previous" ]; then cmd_rollback "$previous"; fi
    exit 1
  fi
}

cmd_rollback() {
  local target sha
  target="${1:-$(previous_tag)}"
  if [ -z "$target" ]; then
    echo "no previous deployment recorded" >&2
    exit 1
  fi
  if ! docker image inspect "$IMAGE_NAME:$target" >/dev/null 2>&1; then
    echo "image $IMAGE_NAME:$target no longer exists - raise KEEP" >&2
    exit 1
  fi

  sha="$(awk -v t="$target" '$2 == t { print $3 }' "$HISTORY" | tail -1)"
  if [ -n "$sha" ]; then git -c advice.detachedHead=false checkout --quiet "$sha"; fi
  set_env IMAGE_TAG "$target"
  docker compose up -d --remove-orphans
  echo "rolled back to $target (source ${sha:-unknown})"
  echo "run 'git checkout main' once the fix is pushed, then ./deploy.sh"
}

cmd_list() {
  echo "active: $(current_tag || echo none)"
  cat "$HISTORY"
}

cmd_prune() {
  local keep image_tag
  keep="$(awk '{ print $2 }' "$HISTORY" | tail -n "$KEEP")"
  for image_tag in $(docker image ls --format '{{.Tag}}' "$IMAGE_NAME"); do
    case "$image_tag" in
      latest | '<none>') continue ;;
    esac
    if ! printf '%s\n' "$keep" | grep -qx "$image_tag"; then
      docker image rm "$IMAGE_NAME:$image_tag" >/dev/null 2>&1 || true
    fi
  done
  tail -n 50 "$HISTORY" >"$HISTORY.tmp" && mv "$HISTORY.tmp" "$HISTORY"
}

# <utc date>-<utc hhmm>-<short sha>: sorts chronologically in `docker image ls`
# and stays traceable to the source with `git show`.
new_tag() {
  local base candidate suffix
  base="$(date -u +%Y%m%d-%H%M)-$(git rev-parse --short HEAD)"
  candidate="$base"
  suffix=2
  while docker image inspect "$IMAGE_NAME:$candidate" >/dev/null 2>&1; do
    candidate="$base-$suffix"
    suffix=$((suffix + 1))
  done
  printf '%s\n' "$candidate"
}

current_tag() {
  [ -f .env ] && sed -n 's/^IMAGE_TAG=//p' .env | tail -1
}

# The entry before the running one; the last known-good one if the running tag
# is unknown (i.e. the deploy that set it never became healthy).
previous_tag() {
  awk -v cur="$(current_tag || true)" '
    $2 == cur { print prev; found = 1; exit }
    { prev = $2 }
    END { if (!found) print prev }
  ' "$HISTORY"
}

set_env() {
  local key="$1" value="$2"
  touch .env
  if grep -q "^${key}=" .env; then
    sed "s|^${key}=.*|${key}=${value}|" .env >.env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$key" "$value" >>.env
  fi
}

# Probed from inside the container with busybox wget: the traefik mode publishes
# no port on the host, and the container always serves on 80 whatever PORT
# publishes it as.
healthy() {
  docker compose ps --status running --quiet | grep -q . || return 1
  local i=0
  while [ "$i" -lt 30 ]; do
    if docker compose exec -T "$SERVICE" wget -q -O /dev/null 'http://127.0.0.1:80/' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  return 1
}

mkdir -p "$STATE"
touch "$HISTORY"

case "${1:-deploy}" in
  deploy) cmd_deploy ;;
  rollback) cmd_rollback "${2:-}" ;;
  list) cmd_list ;;
  prune) cmd_prune ;;
  *)
    echo "usage: $0 [deploy | rollback [tag] | list | prune]" >&2
    exit 2
    ;;
esac
