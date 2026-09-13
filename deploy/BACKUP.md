# PostgreSQL backup and restore

## Google Drive destination

The expected rclone remote is `gdrive:` and the remote layout is:

```text
Green-AQI-Research/
├── 01_raw_archive/
├── 02_database_backup/
├── 03_datasets/
├── 04_models/
├── 05_experiments/
├── 06_figures/
└── 07_paper/
```

Configure OAuth interactively as the VM operator; never commit the rclone
configuration or token:

```bash
rclone config
```

Create a Google Drive remote named `gdrive`, then verify it and create the
folder layout:

```bash
rclone listremotes
rclone lsd gdrive:
./deploy/scripts/initialize-google-drive.sh
```

## Manual backup

The backup script runs `pg_dump` inside the PostgreSQL container, streams a
plain SQL dump through gzip, validates the gzip archive, writes a SHA-256
sidecar, and uploads both files with `rclone copyto`:

```bash
./deploy/scripts/backup-postgres.sh
```

Local backups are stored under `/opt/green-aqi/backups/postgres` with mode
restricted by `umask 077`. Files older than seven days are removed locally
only after a successful upload. Remote files are never automatically deleted.

## Restore validation

Test the latest backup without touching the production database:

```bash
./deploy/scripts/restore-test.sh \
  /opt/green-aqi/backups/postgres/green_aqi_TIMESTAMP.sql.gz
```

The script creates a uniquely named temporary database, restores into it,
checks the three research tables, and removes only that temporary database.
It never restores over the production database.

## Nightly schedule

Install the checked-in units after the Drive remote and a manual backup have
both been verified:

```bash
install -m 0644 deploy/systemd/green-aqi-backup.service /etc/systemd/system/
install -m 0644 deploy/systemd/green-aqi-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now green-aqi-backup.timer
systemctl list-timers green-aqi-backup.timer
```

The timer runs at 02:00 UTC with up to ten minutes of randomized delay. It is
persistent, so systemd runs a missed backup after the VM returns online.
