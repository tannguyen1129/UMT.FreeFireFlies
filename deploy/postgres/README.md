# Research PostgreSQL schema

`init/001-research-schema.sql` is the bootstrap schema for a new Paper 1
PostgreSQL volume. The Postgres image runs files in `docker-entrypoint-initdb.d`
only when the data directory is empty.

The schema creates:

- `aq_grid_points`
- `air_quality_observations`
- `weather_observations`

Observation uniqueness is enforced by `(source, grid_point_id,
source_observed_at)`. Source timestamps, ingestion timestamps, and creation
timestamps use PostgreSQL `timestamptz`; the research containers run with UTC
timezone settings. Original upstream responses are retained in `jsonb`.

Do not edit an already-applied bootstrap file to migrate a live database. Add
a new numbered migration for every future schema change.
