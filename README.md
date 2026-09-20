# HASUT

A location-intelligent network where people discover nearby professionals, businesses, skills, opportunities and live activity — and professionals can turn those connections into businesses.

HASUT is inspired by Hebrew **חסות** (patronage, support, sponsorship, mutual backing, connection).

## Status

**Sprints 0–9 complete (Phase 1).** Phase 2 stories and live HLS are implemented behind the `stories.live` flag. See [sprint breakdown](./docs/product/sprint-breakdown.md). Peer and chat payloads never include phone numbers. Paid subscriptions are not implemented.

## Quick start

One command after Node.js 22+, pnpm, and Docker Desktop:

```bash
pnpm install
cp .env.example .env
pnpm dev:up
```

That starts Redis (and Postgres/PostGIS + MinIO) in Docker, migrates, seeds if needed, then runs API, web, and admin on your machine. Stop apps with `pnpm dev:down`; add `--infra` to stop the Docker data stores too.

```bash
# Windows PowerShell
.\scripts\dev-up.ps1

# macOS / Linux
chmod +x scripts/dev-up.sh
./scripts/dev-up.sh
```

Health: [http://localhost:3001/health/ready](http://localhost:3001/health/ready)  
OpenAPI: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

Local demo login: `7010358490` (or `+917010358490`) with code `123456` after you tap Send code. Seeded people, professionals, businesses, connections, and chats sit around T. Nagar, Chennai — use **Seeded area** on the map if GPS is elsewhere.

Full setup: [docs/development/setup.md](./docs/development/setup.md)

## Workspace

| Path          | Role                                                                  |
| ------------- | --------------------------------------------------------------------- |
| `apps/api`    | NestJS modular monolith                                               |
| `apps/web`    | Next.js member web                                                    |
| `apps/admin`  | Next.js admin                                                         |
| `apps/mobile` | Expo SDK 57 member mobile (Expo Go)                                   |
| `packages/*`  | Shared types, validation, API client, auth storage, config, UI, utils |

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:scripts
pnpm build
```

Docker API (after `pnpm infra:up`): `pnpm infra:up:api` — health at `/health/ready` and `/api/v1/health/ready`.

## Documentation

- [Documentation index](./docs/README.md)
- [Architecture](./docs/architecture/00-overview.md)
- [Phase 1 scope](./docs/product/phase-1-scope.md)
- [Sprint breakdown](./docs/product/sprint-breakdown.md)

## License

[MIT](./LICENSE)
