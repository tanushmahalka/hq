#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HQ_DIR="$ROOT_DIR"
OPENCLAW_DIR="$ROOT_DIR/openclaw"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_clean_repo() {
  local repo_dir="$1"
  local repo_name="$2"

  if [[ ! -d "$repo_dir/.git" ]]; then
    echo "$repo_name is not a git checkout: $repo_dir" >&2
    exit 1
  fi

  if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
    echo "$repo_name has uncommitted changes. Commit or stash them before pulling." >&2
    git -C "$repo_dir" status --short
    exit 1
  fi
}

pull_repo() {
  local repo_dir="$1"
  local repo_name="$2"

  echo "==> Updating $repo_name"
  git -C "$repo_dir" pull --rebase
}

main() {
  require_cmd git
  require_cmd bun
  require_cmd pnpm

  ensure_clean_repo "$HQ_DIR" "hq"
  ensure_clean_repo "$OPENCLAW_DIR" "openclaw"

  pull_repo "$HQ_DIR" "hq"
  pull_repo "$OPENCLAW_DIR" "openclaw"

  echo "==> Reinstalling hq dependencies"
  (cd "$HQ_DIR" && bun install)

  echo "==> Reinstalling openclaw dependencies"
  (cd "$OPENCLAW_DIR" && pnpm install)

  echo "==> Rebuilding openclaw UI"
  (cd "$OPENCLAW_DIR" && pnpm ui:build)

  echo "==> Rebuilding openclaw"
  (cd "$OPENCLAW_DIR" && pnpm build)

  cat <<EOF

Reinstall complete.

Recommended follow-up:
  cd "$OPENCLAW_DIR" && pnpm openclaw doctor
  cd "$OPENCLAW_DIR" && pnpm openclaw health
  cd "$HQ_DIR" && bun dev
EOF
}

main "$@"
