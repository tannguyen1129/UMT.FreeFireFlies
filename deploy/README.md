# Paper 1 research deployment

This directory contains the deployment definition dedicated to the Paper 1
research data platform. It does not replace the OLP `docker-compose.yml` or
`docker-compose.fiware.yml` files in the repository root.

## Scope

The initial stack contains only:

- PostgreSQL with PostGIS
- MongoDB
- FIWARE Orion-LD
- the existing AQI service as the initial data collector

No host ports are published by this compose file. Network separation and
external ingress will be finalized in Phase 3.

## Configuration

Create the local environment file and replace all placeholders:

```bash
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
```

Never commit `deploy/.env` or real credentials.

Validate the rendered configuration without starting containers:

```bash
docker compose \
  --env-file deploy/.env \
  -f deploy/compose.research.yml \
  config
```

Do not start this stack until the networking review in Phase 3 and the
research schema work in Phase 4 are complete.

## Persistent data

The stack declares three Docker named volumes:

- `research_postgres_data`
- `research_mongo_data`
- `research_collector_uploads`

Removing these volumes can permanently destroy research data. Do not use
`docker compose down --volumes` for this deployment.
