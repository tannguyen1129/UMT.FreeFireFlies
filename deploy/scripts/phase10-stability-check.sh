#!/bin/sh

set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_dir/../.." && pwd)"
compose_file="$repository_root/deploy/compose.research.yml"
environment_file="${GREEN_AQI_ENV_FILE:-$repository_root/deploy/.env}"
minimum_uptime_seconds="${GREEN_AQI_STABILITY_SECONDS:-86400}"

compose() {
  docker compose --env-file "$environment_file" -f "$compose_file" "$@"
}

now_epoch="$(date -u +%s)"
for service in postgres mongo orion-ld collector; do
  container_id="$(compose ps -q "$service")"
  if [ -z "$container_id" ]; then
    echo "FAIL: $service container is not running" >&2
    exit 1
  fi

  inspection="$(docker inspect --format '{{.State.Status}}|{{.State.StartedAt}}|{{.State.Restarting}}|{{.State.OOMKilled}}' "$container_id")"
  status="$(printf '%s' "$inspection" | cut -d'|' -f1)"
  started_at="$(printf '%s' "$inspection" | cut -d'|' -f2)"
  restarting="$(printf '%s' "$inspection" | cut -d'|' -f3)"
  oom_killed="$(printf '%s' "$inspection" | cut -d'|' -f4)"
  started_epoch="$(date -u -d "$started_at" +%s)"
  age_seconds="$((now_epoch - started_epoch))"

  if [ "$status" != "running" ] || [ "$restarting" != "false" ] || [ "$oom_killed" != "false" ]; then
    echo "FAIL: $service state is not stable" >&2
    exit 1
  fi
  if [ "$age_seconds" -lt "$minimum_uptime_seconds" ]; then
    echo "FAIL: $service uptime is ${age_seconds}s; require ${minimum_uptime_seconds}s" >&2
    exit 1
  fi
  echo "PASS: $service uptime=${age_seconds}s"
done

health_status="$(compose exec -T collector node -e '
fetch("http://127.0.0.1:3002/internal/health/research")
  .then(async response => {
    const body = await response.json();
    console.log(response.ok && body.status === "ok" ? "PASS" : "FAIL");
  })
  .catch(() => console.log("FAIL"));
')"
if [ "$health_status" != "PASS" ]; then
  echo "FAIL: research health endpoint is degraded" >&2
  exit 1
fi
echo "PASS: research health endpoint"

database_check="$(compose exec -T postgres sh -c 'psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --tuples-only --no-align --command="
WITH duplicate_count AS (
  SELECT
    (SELECT count(*) FROM (
      SELECT grid_point_id, source_observed_at FROM air_quality_observations
      GROUP BY 1, 2 HAVING count(*) > 1
    ) aq) +
    (SELECT count(*) FROM (
      SELECT grid_point_id, source_observed_at FROM weather_observations
      GROUP BY 1, 2 HAVING count(*) > 1
    ) weather) AS value
)
SELECT CASE WHEN
  (SELECT count(*) FROM aq_grid_points WHERE active) = 25
  AND (SELECT count(*) FROM air_quality_observations) > 0
  AND (SELECT count(*) FROM weather_observations) > 0
  AND (SELECT count(*) FROM air_quality_observations WHERE source_observed_at > ingested_at) = 0
  AND (SELECT count(*) FROM weather_observations WHERE source_observed_at > ingested_at) = 0
  AND (SELECT value FROM duplicate_count) = 0
  AND current_setting('\''TIMEZONE'\'') = '\''UTC'\''
THEN '\''PASS'\'' ELSE '\''FAIL'\'' END;
"')"
if [ "$database_check" != "PASS" ]; then
  echo "FAIL: database quality validation" >&2
  exit 1
fi
echo "PASS: database quality validation"

mongo_entities="$(compose exec -T mongo mongo --quiet --eval 'db.getSiblingDB("orion").entities.countDocuments({})')"
if [ "$mongo_entities" -lt 1 ]; then
  echo "FAIL: Orion MongoDB contains no entities" >&2
  exit 1
fi
echo "PASS: MongoDB entities=$mongo_entities"

if ! systemctl is-active --quiet green-aqi-backup.timer; then
  echo "FAIL: backup timer is inactive" >&2
  exit 1
fi
if ! systemctl show green-aqi-backup.service -p Result --value | grep -Fxq success; then
  echo "FAIL: latest backup service result is not successful" >&2
  exit 1
fi
if ! rclone lsf gdrive:Green-AQI-Research/02_database_backup --files-only | grep -Eq '^green_aqi_.*\.sql\.gz$'; then
  echo "FAIL: no PostgreSQL backup found on Google Drive" >&2
  exit 1
fi
echo "PASS: backup timer and Google Drive archive"

"$repository_root/deploy/scripts/security-check.sh" >/dev/null
echo "PASS: security validation"
echo "PHASE10=PASS checked_at=$(date -u --iso-8601=seconds)"
