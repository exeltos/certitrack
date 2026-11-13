#!/usr/bin/env bash
# Runs the database schema + privacy tests on a throwaway local Postgres.
# Usage: scripts/test-db.sh   (needs PostgreSQL 15+ binaries; set PGBIN if not on PATH)
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"
RUN=""
if [ "$(id -u)" = "0" ]; then chown postgres "$DIR"; RUN="su postgres -c"; fi
run() { if [ -n "$RUN" ]; then $RUN "$*"; else bash -c "$*"; fi; }
run "$PGBIN/initdb -D $DIR/data -U postgres --auth=trust >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/data -o '-p 54399 -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
trap 'run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null"; rm -rf "$DIR"' EXIT
PSQL="$PGBIN/psql -h $DIR -p 54399 -U postgres -v ON_ERROR_STOP=1 -q -X"
$PSQL -c "create database ct"
$PSQL -d ct -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do $PSQL -d ct -1 -f "$f"; done
$PSQL -d ct -f supabase/tests/10_peer_network_test.sql 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ (NOTICE|INFO):  //'
