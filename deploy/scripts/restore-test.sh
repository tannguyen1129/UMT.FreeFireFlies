#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/green_aqi_TIMESTAMP.sql.gz" >&2
  exit 2
fi

backup_path="$1"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_dir/../.." && pwd)"
compose_file="$repository_root/deploy/compose.research.yml"
environment_file="${GREEN_AQI_ENV_FILE:-$repository_root/deploy/.env}"
restore_database="green_aqi_restore_test_$(date -u +%Y%m%d_%H%M%S)"

if [ ! -f "$backup_path" ]; then
  echo "Backup not found: $backup_path" >&2
  exit 2
fi
if [ ! -f "$environment_file" ]; then
  echo "Environment file not found: $environment_file" >&2
  exit 2
fi
gzip -t "$backup_path"

compose_exec() {
  docker compose --env-file "$environment_file" -f "$compose_file" exec -T postgres "$@"
}

database_command() {
  command_name="$1"
  shift
  compose_exec sh -c "exec $command_name --username=\"\$POSTGRES_USER\" \"\$@\"" sh "$@"
}

cleanup_restore_database() {
  database_command dropdb --if-exists "$restore_database" >/dev/null 2>&1 || true
}
trap cleanup_restore_database EXIT HUP INT TERM

database_command createdb "$restore_database"
gzip -dc "$backup_path" | compose_exec sh -c \
  'exec psql --username="$POSTGRES_USER" --dbname="$1" --set=ON_ERROR_STOP=1' \
  sh "$restore_database" >/dev/null

table_count="$(compose_exec sh -c 'exec psql --username="$POSTGRES_USER" "$@"' sh \
  --dbname="$restore_database" --tuples-only --no-align --command="
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('aq_grid_points', 'air_quality_observations', 'weather_observations');
")"

if [ "$table_count" != "3" ]; then
  echo "Restore validation failed: expected 3 research tables, found $table_count" >&2
  exit 1
fi

echo "Restore validation passed using temporary database: $restore_database"
