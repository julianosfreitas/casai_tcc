#!/usr/bin/env bash
# Reseta a senha do usuario 'postgres' para 'postgres' (uso local/dev).
# Estrategia: habilita auth 'trust' temporariamente no pg_hba.conf, recarrega,
# executa ALTER USER, e RESTAURA o pg_hba.conf original. Faz backup antes.
# Rode com: sudo bash scripts/reset-pg-password.sh
set -euo pipefail

PGROOT=/Library/PostgreSQL/18
BIN="$PGROOT/bin"
DATA="$PGROOT/data"
HBA="$DATA/pg_hba.conf"
BAK="$HBA.casai.bak"
NEWPW='postgres'

if [[ $EUID -ne 0 ]]; then
  echo "ERRO: rode com sudo (sudo bash scripts/reset-pg-password.sh)" >&2
  exit 1
fi

echo "==> Backup do pg_hba.conf -> $BAK"
cp "$HBA" "$BAK"

restore() {
  echo "==> Restaurando pg_hba.conf original"
  mv -f "$BAK" "$HBA"
  chown postgres:daemon "$HBA"
  chmod 600 "$HBA"
  su -m postgres -c "$BIN/pg_ctl -D $DATA reload" || true
}
trap restore EXIT

echo "==> Prepende regras 'trust' temporarias no topo do pg_hba.conf"
{
  echo "local   all   all                  trust"
  echo "host    all   all   127.0.0.1/32   trust"
  echo "host    all   all   ::1/128        trust"
  cat "$BAK"
} > "$HBA"
chown postgres:daemon "$HBA"
chmod 600 "$HBA"

echo "==> Reload do Postgres"
su -m postgres -c "$BIN/pg_ctl -D $DATA reload"
sleep 1

echo "==> ALTER USER postgres PASSWORD"
su -m postgres -c "$BIN/psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c \"ALTER USER postgres PASSWORD '$NEWPW';\""

echo "==> OK: senha do postgres definida como '$NEWPW'"
# restore() roda automaticamente no trap EXIT
echo "RESET_DONE"
