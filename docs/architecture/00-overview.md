# Architecture overview

**Status:** Proposed for Phase 1  
**Date:** 2026-09-04  
**Style:** Modular monolith in a pnpm + Turborepo monorepo

## What Phase 1 is

HASUT Phase 1 is a **Local Discovery Network**. A member registers with phone OTP, creates a profile, sets an approximate location, discovers nearby people, professionals and businesses, connects, and chats. A member may become a professional (multiple categories, service area, current mode) or own a business. Admins operate users, catalog, verification, reports, support, theme, remote config, feature flags, and audit.

HASUT is **not** a marketplace, booking engine, CRM, billing system, or live platform in Phase 1. Those domains get extension points only.

## System shape

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│  apps/web   │  │ apps/mobile │  │  apps/admin  │
│  Next.js    │  │ Expo RN     │  │  Next.js     │
└──────┬──────┘  └──────┬──────┘  └──────┬───────┘
       │                │                │
       │         packages/api-client     │
       │         packages/types          │
       │         packages/validation     │
       │         packages/auth           │
       │         packages/ui + config    │
       └────────────────┼────────────────┘
                        │  HTTPS /api/v1
                        ▼
                 ┌─────────────┐
                 │  apps/api   │  NestJS modular monolith
                 └──────┬──────┘
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
     PostgreSQL     Object storage    OTP provider
     + PostGIS      (S3-compatible)   (MSG91 → Twilio)
```

All product surfaces talk to **one API**. Admin is a separate Next.js app with a stricter role gate; it does not own a second database or a second domain model.

## Applications

| App           | Role                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `apps/web`    | Member web: discovery, profiles, connections, chat, support                     |
| `apps/mobile` | Member mobile (primary experience): map-first discovery                         |
| `apps/admin`  | Operations: users, catalog, verification, reports, support, theme, flags, audit |
| `apps/api`    | Single backend. NestJS modules with enforced dependency direction               |

## Shared packages

| Package               | Owns                                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| `packages/types`      | Domain enums, DTO shapes, API envelope types                                |
| `packages/validation` | Zod (or equivalent) schemas used by API and clients                         |
| `packages/api-client` | Typed HTTP client; the only network access layer for web/mobile/admin       |
| `packages/auth`       | Session helpers, token storage adapters (web cookie vs mobile secure store) |
| `packages/ui`         | Design-system components consuming tokens, not hardcoded colors             |
| `packages/config`     | Feature-flag and remote-config client with cache                            |
| `packages/utils`      | Pure helpers (phone E.164, distance display buckets, IDs)                   |

No app may invent a parallel type, validator, or API client.

## Architectural principles

1. **One identity.** `Member` is the only login principal. Professional and Business are profiles/entities on that member. Admin, Support Agent, and Moderator are roles.
2. **Modular monolith.** Clear NestJS module boundaries. No circular imports. No microservices in Phase 1.
3. **Contracts in packages.** Web, Mobile, and Admin stay compatible through `types`, `validation`, and `api-client`.
4. **Privacy by default.** Exact personal coordinates never leave the API in public or peer payloads. Phone numbers are not public.
5. **Config over code.** Categories, current modes, support categories, ranking weights, theme tokens, and feature flags live in the database and admin UI.
6. **Anticipate, do not build.** Subscriptions, CRM, invoices, payments, booking, live, tokens, and protected services are named extension points, not tables or APIs in Phase 1 unless a foundation row is required for identity/verification.
7. **Security in depth.** Validation, RBAC at service layer, rate limits, audit on admin mutations, signed uploads, no secrets in git.

## Runtime topology (local)

docker-compose runs:

- PostgreSQL 16 with PostGIS
- Local S3 (MinIO) for media
- `apps/api`
- Optional Redis later for rate-limit/cache; Phase 1 may start with in-process limits and move to Redis when multi-instance is required. Decision: introduce Redis in Sprint 0 only if rate limiting and theme cache need a shared store for multiple API replicas. Local single-process can use memory + Postgres. **Recommendation:** include Redis in compose from Sprint 0 so rate limits and config cache are multi-instance-safe from day one, without splitting services.

## What is explicitly deferred

Do not add modules, tables, or UI for: subscriptions, CRM, invoices, billing, marketplace checkout, booking calendar, payments, live streaming, token wallets, creator rewards, advanced analytics warehouses, team seats, multi-city operational tooling beyond location data, or Protected Service workflows.

Document extension points in module READMEs when those modules are created.

## Next documents

- [Folder structure](./01-folder-structure.md)
- [Module boundaries](./02-module-boundaries.md)
- [Sprint breakdown](../product/sprint-breakdown.md)
