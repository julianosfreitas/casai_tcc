#!/usr/bin/env bash
# CASAI — watchdog de demonstração.
# Imprime um heartbeat no terminal a cada N segundos (default 30s) e, por padrão,
# reergue a API/Web caso caiam — para a aplicação ficar sempre ativa numa demo.
#
# Uso:
#   bash scripts/casai-watchdog.sh                 # heartbeat 30s + auto-restart
#   bash scripts/casai-watchdog.sh --no-restart    # só observa, não reergue
#   CASAI_HC_INTERVAL=10 bash scripts/casai-watchdog.sh   # intervalo custom
#
# Parar: Ctrl+C.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL="${CASAI_HC_INTERVAL:-30}"
API_PORT="${CASAI_API_PORT:-4000}"
WEB_PORT="${CASAI_WEB_PORT:-3000}"
DB_PORT="${CASAI_DB_PORT:-5432}"
API_LOG="${CASAI_API_LOG:-/tmp/casai-api.log}"
WEB_LOG="${CASAI_WEB_LOG:-/tmp/casai-web.log}"

RESTART=1
[ "${1:-}" = "--no-restart" ] && RESTART=0

grn=$'\033[32m'; red=$'\033[31m'; yel=$'\033[33m'; dim=$'\033[2m'; rst=$'\033[0m'
ts() { date '+%H:%M:%S'; }

# testa porta TCP aberta sem depender de curl/nc (usa /dev/tcp do bash)
port_up() {
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null && { exec 3>&- 3<&-; return 0; }
  return 1
}

start_api() { ( cd "$ROOT/apps/api" && nohup npm run start:dev >>"$API_LOG" 2>&1 & ); }
start_web() { ( cd "$ROOT/apps/web" && nohup npm run dev      >>"$WEB_LOG" 2>&1 & ); }

trap 'printf "\n%s watchdog parado.\n" "$(ts)"; exit 0' INT TERM

printf "%sCASAI watchdog%s — intervalo %ss — restart=%s\n" "$grn" "$rst" "$INTERVAL" \
  "$([ "$RESTART" = 1 ] && echo on || echo off)"
printf "%salvos: api:%s  web:%s  db:%s%s\n" "$dim" "$API_PORT" "$WEB_PORT" "$DB_PORT" "$rst"

while true; do
  api=down; web=down; db=down
  port_up localhost "$API_PORT" && api=up
  port_up localhost "$WEB_PORT" && web=up
  port_up localhost "$DB_PORT"  && db=up

  if [ "$RESTART" = 1 ]; then
    [ "$api" = down ] && { printf "%s %s↻ API :%s caiu — reerguendo (npm run start:dev)%s\n" "$(ts)" "$yel" "$API_PORT" "$rst"; start_api; }
    [ "$web" = down ] && { printf "%s %s↻ WEB :%s caiu — reerguendo (npm run dev)%s\n"      "$(ts)" "$yel" "$WEB_PORT" "$rst"; start_web; }
  fi
  # Postgres é serviço do sistema (LaunchDaemon EDB) — não reergo, só aviso.
  [ "$db" = down ] && printf "%s %s⚠ Postgres :%s fora — suba o serviço manualmente%s\n" "$(ts)" "$red" "$DB_PORT" "$rst"

  if [ "$api" = up ] && [ "$web" = up ] && [ "$db" = up ]; then
    printf "%s %s✅ healthy%s — api:up web:up db:up\n" "$(ts)" "$grn" "$rst"
  else
    printf "%s %s✗ degraded%s — api:%s web:%s db:%s\n" "$(ts)" "$red" "$rst" "$api" "$web" "$db"
  fi

  sleep "$INTERVAL"
done
