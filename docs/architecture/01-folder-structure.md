# Folder structure

Target monorepo layout (Sprint 0 created these directories):

```
Hasut/
  apps/
    api/                      # NestJS modular monolith
    web/                      # Next.js member web
    mobile/                   # Expo React Native
    admin/                    # Next.js admin
  packages/
    ui/
    types/
    validation/
    api-client/
    auth/
    config/
    utils/
  docs/
    architecture/
    database/
    api/
    security/
    development/              # setup.md + setup.html (install, scripts, ports, env)
    product/
  infra/
    docker/
    compose/                  # local postgres+postgis, minio, redis, api
  scripts/
    dev-up.mjs                # one-command local kickoff (Redis via Docker)
    dev-down.mjs              # stop host apps; --infra stops Compose
  .github/workflows/          # or equivalent CI
  turbo.json
  pnpm-workspace.yaml
  package.json
  .env.example                # names only, never values that are secrets
```

## apps/api (NestJS)

```
apps/api/src/
  main.ts
  app.module.ts
  common/
    filters/                  # structured error envelope
    interceptors/             # request ID, logging
    guards/                   # authn, authz
    pipes/                    # zod / class-validator bridge
    middleware/
  modules/
    auth/
    users/
    profiles/
    locations/
    categories/
    professionals/
    businesses/
    services/
    discovery/
    connections/
    messaging/
    media/
    verification/
    reviews/
    notifications/
    reports/
    support/
    admin/
    configuration/
    audit/
  prisma/
    schema.prisma
    migrations/
```

Each module typically contains:

```
<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.repository.ts
  dto/
  <module>.constants.ts
  <module>.module.spec.ts
```

Keep domain logic in the service. Controllers only translate HTTP. Repositories isolate Prisma. Do not put Prisma calls in controllers.

PostGIS-specific SQL lives in Prisma migrations, not in application string-concatenated queries.

## apps/web and apps/admin (Next.js)

```
apps/web/src/
  app/                        # App Router
  components/                 # app-specific composition only
  lib/                        # thin wrappers around packages/*
```

```
apps/admin/src/
  app/
  components/                 # admin chrome, tables, theme editor
  lib/
```

Visual primitives come from `packages/ui`. Data access comes from `packages/api-client`. Do not fetch `apps/api` URLs with raw `fetch` scattered through components.

## apps/mobile (Expo)

```
apps/mobile/src/
  app/                        # Expo Router
  screens/
  components/
  lib/
```

Token storage uses the `packages/auth` mobile adapter (secure store). Theme and remote config use `packages/config` with TTL cache.

## packages/ui

```
packages/ui/src/
  tokens/                     # TypeScript token contract (no hex in components)
  theme/                      # CSS variables / RN theme mapping
  components/                 # Button, Card, Sheet, MapMarker, Rating, ...
  index.ts
```

Components accept semantic token names or consume the active theme. They never contain `#` color literals.

## What does not exist in Phase 1

- `apps/billing`, `apps/realtime-worker` as separate deployables
- `packages/marketplace`, `packages/crm`
- Per-frontend duplicate `types.ts` or `api.ts`
