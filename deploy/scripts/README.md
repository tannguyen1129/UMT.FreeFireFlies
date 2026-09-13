# Research deployment scripts

## `create-networks.sh`

Creates the three explicitly named research networks if they do not exist.
The script is idempotent and creates `green-aqi-data` as an internal network.

Run it before the first compose deployment:

```bash
./deploy/scripts/create-networks.sh
```

## `healthcheck.sh`

Calls the collector's internal research health endpoint from inside its
container, prints formatted JSON, and exits non-zero when the platform is
degraded:

```bash
./deploy/scripts/healthcheck.sh
```

An alternative environment-file path may be passed as the first argument.

## Backup scripts

- `initialize-google-drive.sh` creates the approved Drive folder layout.
- `backup-postgres.sh` creates, validates, checksums, and uploads a dump.
- `restore-test.sh` restores a dump into an isolated temporary database.

See `deploy/BACKUP.md` for operator instructions and safety constraints.
