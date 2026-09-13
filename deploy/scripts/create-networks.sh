#!/bin/sh

set -eu

create_bridge_network() {
  network_name="$1"
  expected_internal="$2"
  shift
  shift

  if docker network inspect "$network_name" >/dev/null 2>&1; then
    actual_driver="$(docker network inspect --format '{{.Driver}}' "$network_name")"
    actual_internal="$(docker network inspect --format '{{.Internal}}' "$network_name")"
    if [ "$actual_driver" != "bridge" ] || [ "$actual_internal" != "$expected_internal" ]; then
      echo "Network has unexpected settings: $network_name" >&2
      exit 1
    fi
    echo "Network already exists: $network_name"
    return
  fi

  docker network create --driver bridge "$@" "$network_name" >/dev/null
  echo "Created network: $network_name"
}

create_bridge_network green-aqi-edge false
create_bridge_network green-aqi-app false
create_bridge_network green-aqi-data true --internal
