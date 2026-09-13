#!/bin/sh

set -eu
umask 077

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_dir/../.." && pwd)"
compose_file="$repository_root/deploy/compose.research.yml"
environment_file="${GREEN_AQI_ENV_FILE:-$repository_root/deploy/.env}"
backup_directory="${GREEN_AQI_BACKUP_DIR:-/opt/green-aqi/backups/postgres}"
remote_name="${GREEN_AQI_RCLONE_REMOTE:-gdrive}"
remote_directory="${GREEN_AQI_REMOTE_BACKUP_DIR:-Green-AQI-Research/02_database_backup}"
retention_days="${GREEN_AQI_LOCAL_RETENTION_DAYS:-7}"

case "$retention_days" in
  ''|*[!0-9]*) echo "GREEN_AQI_LOCAL_RETENTION_DAYS must be a non-negative integer" >&2; exit 2 ;;
esac

if [ ! -f "$environment_file" ]; then
  echo "Environment file not found: $environment_file" >&2
  exit 2
fi
if ! rclone listremotes | grep -Fxq "${remote_name}:"; then
  echo "rclone remote is not configured: ${remote_name}:" >&2
  exit 2
fi

mkdir -p "$backup_directory"
timestamp="$(date -u +%Y-%m-%d_%H%M%S)"
filename="green_aqi_${timestamp}.sql.gz"
backup_path="$backup_directory/$filename"
partial_path="$backup_path.partial"
checksum_path="$backup_path.sha256"

cleanup_partial() {
  rm -f -- "$partial_path"
}
trap cleanup_partial EXIT HUP INT TERM

docker compose \
  --env-file "$environment_file" \
  -f "$compose_file" \
  exec -T postgres sh -c \
  'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' \
  | gzip -9 > "$partial_path"

gzip -t "$partial_path"
mv -- "$partial_path" "$backup_path"
sha256sum "$backup_path" > "$checksum_path"

rclone copyto "$backup_path" "${remote_name}:${remote_directory}/${filename}" \
  --checksum --retries 3 --low-level-retries 10
rclone copyto "$checksum_path" "${remote_name}:${remote_directory}/${filename}.sha256" \
  --checksum --retries 3 --low-level-retries 10

remote_size="$(rclone size "${remote_name}:${remote_directory}/${filename}" --json)"
echo "Remote verification: $remote_size"

find "$backup_directory" -maxdepth 1 -type f \
  \( -name 'green_aqi_*.sql.gz' -o -name 'green_aqi_*.sql.gz.sha256' \) \
  -mtime "+$retention_days" -delete

echo "Backup completed: $backup_path"
