#!/bin/sh

set -eu

failed=0
forbidden_ports='5432 27017 27018 1026 3000 3001 3002 3003 3004 5000 9090'

echo "Host TCP listeners:"
ss -lntp

echo
echo "Docker port publications:"
docker ps --format '{{.Names}}\t{{.Ports}}'

for port in $forbidden_ports; do
  if ss -H -lnt "sport = :$port" | grep -q .; then
    echo "FAIL: forbidden host TCP listener on port $port" >&2
    failed=1
  fi
done

published_ports="$(docker ps --format '{{.Ports}}' | grep -E '(^|, )[[:digit:].:[\]-]+->' || true)"
if [ -n "$published_ports" ]; then
  echo "FAIL: Docker publishes one or more host ports:" >&2
  echo "$published_ports" >&2
  failed=1
fi

sshd_effective="$(sshd -T)"
password_authentication="$(printf '%s\n' "$sshd_effective" | awk '$1 == "passwordauthentication" {print $2}')"
permit_root_login="$(printf '%s\n' "$sshd_effective" | awk '$1 == "permitrootlogin" {print $2}')"

if [ "$password_authentication" != "no" ]; then
  echo "FAIL: SSH PasswordAuthentication is $password_authentication" >&2
  failed=1
fi
if [ "$permit_root_login" != "no" ]; then
  echo "FAIL: SSH PermitRootLogin is $permit_root_login" >&2
  failed=1
fi

for secret_file in deploy/.env /root/.config/rclone/rclone.conf; do
  if [ -e "$secret_file" ]; then
    mode="$(stat -c '%a' "$secret_file")"
    if [ "$mode" != "600" ]; then
      echo "FAIL: $secret_file has mode $mode; expected 600" >&2
      failed=1
    fi
  fi
done

if [ "$failed" -ne 0 ]; then
  echo "Security validation failed." >&2
  exit 1
fi

echo "Security validation passed."
