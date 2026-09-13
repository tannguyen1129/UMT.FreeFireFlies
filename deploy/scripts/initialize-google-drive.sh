#!/bin/sh

set -eu

remote_name="${GREEN_AQI_RCLONE_REMOTE:-gdrive}"
root_directory="${GREEN_AQI_REMOTE_ROOT:-Green-AQI-Research}"

if ! rclone listremotes | grep -Fxq "${remote_name}:"; then
  echo "rclone remote is not configured: ${remote_name}:" >&2
  exit 2
fi

for directory in \
  01_raw_archive \
  02_database_backup \
  03_datasets \
  04_models \
  05_experiments \
  06_figures \
  07_paper
do
  rclone mkdir "${remote_name}:${root_directory}/${directory}"
done

rclone lsf "${remote_name}:${root_directory}" --dirs-only
