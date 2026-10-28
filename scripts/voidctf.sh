#!/usr/bin/env bash
# VOID//CTF management script for macOS, Linux, WSL and Git Bash.
# Usage: ./scripts/voidctf.sh <command>   (same commands as voidctf.cmd on Windows)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

say()  { printf '\033[32m[void]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[void]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[void]\033[0m %s\n' "$*" >&2; exit 1; }

secret() { od -An -tx1 -N"${1:-32}" /dev/urandom | tr -d ' \n'; }
envval() { [ -f .env ] && grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }

need_docker() {
  command -v docker >/dev/null || die "Docker not found. Install Docker Desktop or Docker Engine with the compose plugin."
  docker info >/dev/null 2>&1 || die "Docker is installed but not running."
}

init() {
  if [ -f .env ]; then say ".env already exists - leaving it untouched."; return; fi
  sed -e "s/^SECRET_KEY=.*/SECRET_KEY=$(secret 32)/" \
      -e "s/^DB_PASSWORD=.*/DB_PASSWORD=$(secret 18)/" \
      -e "s/^DB_ROOT_PASSWORD=.*/DB_ROOT_PASSWORD=$(secret 18)/" .env.example > .env
  chmod 600 .env
  say "Created .env with new random secrets."
}

wait_healthy() {
  local port; port="$(envval CTFD_PORT)"; port="${port:-8000}"
  say "Waiting for CTFd at http://localhost:$port ..."
  for _ in $(seq 1 90); do
    if curl -fsS "http://localhost:$port/healthcheck" >/dev/null 2>&1; then
      say "VOID//CTF is running: http://localhost:$port"; return 0
    fi
    sleep 2
  done
  warn "CTFd did not report healthy yet. Check: ./scripts/voidctf.sh logs"
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  init) init ;;
  up) need_docker; init; docker compose up -d; wait_healthy ;;
  down) need_docker; docker compose --profile training down; say "Stopped. Data is preserved in Docker volumes." ;;
  restart) need_docker; docker compose restart ctfd; wait_healthy ;;
  status) need_docker; docker compose --profile training ps ;;
  logs) need_docker; docker compose logs -f --tail 200 ctfd ;;
  backup)
    need_docker; mkdir -p backups
    name="voidctf-$(date +%Y%m%d-%H%M%S).zip"
    docker compose exec -T ctfd python manage.py export_ctf "/tmp/$name"
    docker compose cp "ctfd:/tmp/$name" "backups/$name"
    docker compose exec -T ctfd rm -f "/tmp/$name"
    say "Backup written to backups/$name" ;;
  restore)
    need_docker; [ -f "${1:-}" ] || die "Usage: ./scripts/voidctf.sh restore backups/<file>.zip"
    read -r -p "Importing replaces ALL current event data. Type RESTORE to continue: " a
    [ "$a" = "RESTORE" ] || { warn "Cancelled."; exit 0; }
    docker compose cp "$1" ctfd:/tmp/restore.zip
    docker compose exec -T ctfd python manage.py import_ctf /tmp/restore.zip --delete_import_on_finish
    docker compose restart ctfd; say "Import finished." ;;
  reset)
    need_docker
    warn "This permanently deletes the database, uploads and logs of this local event."
    warn "Tip: run './scripts/voidctf.sh backup' first."
    read -r -p "Type RESET to delete all VOID//CTF data: " a
    [ "$a" = "RESET" ] || { warn "Cancelled."; exit 0; }
    docker compose --profile training down -v
    say "All event data removed. Run './scripts/voidctf.sh up' for a fresh setup wizard." ;;
  build-theme)
    cd theme/void
    if command -v npm >/dev/null; then npm ci --no-audit --no-fund && npm run build
    else need_docker; docker run --rm -v "$PWD:/theme" -w /theme node:20-alpine sh -c "npm ci --no-audit --no-fund && npm run build"; fi
    say "Theme rebuilt into theme/void/static." ;;
  load-pack)
    port="$(envval CTFD_PORT)"; port="${port:-8000}"
    if [ -z "${CTFD_TOKEN:-}" ]; then
      echo "Create an admin token: log in as admin -> Settings -> Access Tokens -> Generate."
      read -r -s -p "Paste the admin access token: " CTFD_TOKEN; echo; export CTFD_TOKEN
    fi
    python3 tools/load_pack.py --url "http://localhost:$port" "$@" ;;
  training-up) need_docker; docker compose --profile training up -d web-training
    say "Web training target: http://localhost:$(envval TRAINING_WEB_PORT || echo 8081)" ;;
  training-down) need_docker; docker compose --profile training stop web-training ;;
  *) sed -n '2,3p' "$0"; echo
     echo "Commands: init up down restart status logs backup restore<zip> reset build-theme load-pack training-up training-down" ;;
esac
