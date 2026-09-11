# OpenAPI

The NestJS app serves Swagger UI at `/api/docs` and JSON at `/api/docs-json`.

Do not hand-write a parallel OpenAPI file. When routes change, annotations and DTOs on the API must remain the source of truth.

Sprint 0 documents:

- `GET /health` and `GET /health/ready` — readiness (Postgres, PostGIS, Redis)
- `GET /health/live` — process liveness
- `GET /api/v1/health` and `GET /api/v1/health/ready` — same readiness under the versioned prefix
- `GET /api/v1/health/live` — versioned liveness

Envelope and error codes: [conventions.md](./conventions.md).
