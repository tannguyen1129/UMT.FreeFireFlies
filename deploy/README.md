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

The collector reads its 25 query coordinates from the version-controlled
`config/research-grid.json` file. They are research grid points and must not be
represented as physical monitoring stations.

No host ports are published by this compose file.

## Network isolation

The deployment uses three explicitly named external Docker bridge networks:

| Network | Purpose | Current members |
| --- | --- | --- |
| `green-aqi-edge` | Reserved for a reviewed public ingress proxy | None |
| `green-aqi-app` | Collector-to-application communication and outbound upstream access | Collector, Orion-LD |
| `green-aqi-data` | Private database communication | PostgreSQL, MongoDB, Orion-LD, collector |

`green-aqi-data` is created with `internal: true`. PostgreSQL and MongoDB
are connected only to this network. Orion-LD bridges the application and data
networks, while the collector uses the application network for upstream API
access and the data network for PostgreSQL access.

The edge network intentionally has no member in the initial stack because no
research endpoint is publicly exposed yet. A future ingress service may join
the edge and application networks after review.

Create the networks before the first deployment:

```bash
./deploy/scripts/create-networks.sh
```

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

Do not start this stack until the research schema work in Phase 4 is complete.

Confirm that no port is published:

```bash
docker compose \
  --env-file deploy/.env \
  -f deploy/compose.research.yml \
  config | grep -nE 'published:|host_ip:'
```

The expected result is no output. After the stack is eventually deployed,
inspect each network with:

```bash
docker network inspect green-aqi-edge green-aqi-app green-aqi-data
```

## Persistent data

The stack declares three Docker named volumes:

- `research_postgres_data`
- `research_mongo_data`
- `research_collector_uploads`

Removing these volumes can permanently destroy research data. Do not use
`docker compose down --volumes` for this deployment.

On a new PostgreSQL volume, scripts under `postgres/init/` create the research
schema. These bootstrap scripts do not rerun against a populated volume.
TypeORM schema synchronization is disabled for the research deployment.
