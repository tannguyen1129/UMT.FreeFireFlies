#!/bin/sh

set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_dir/../.." && pwd)"
environment_file="${1:-$repository_root/deploy/.env}"

if [ ! -f "$environment_file" ]; then
  echo "Environment file not found: $environment_file" >&2
  exit 2
fi

docker compose \
  --env-file "$environment_file" \
  -f "$repository_root/deploy/compose.research.yml" \
  exec -T collector node -e '
    fetch("http://127.0.0.1:3002/internal/health/research")
      .then(async (response) => {
        const body = await response.json();
        process.stdout.write(JSON.stringify(body, null, 2) + "\n");
        if (!response.ok) process.exit(1);
      })
      .catch((error) => {
        process.stderr.write(`Health check failed: ${error.message}\n`);
        process.exit(1);
      });
  '
