# HASUT documentation

HASUT is a location-intelligent professional and business network. Phase 1 delivers the **Local Discovery Network** MVP. Stories and live streaming are Phase 2. Marketplace, billing, CRM, and the creator economy stay deferred after that.

## Current repository state

Sprints 0–9 are implemented (Phase 1). Phase 2 stories/live: [phase-2-scope.md](./product/phase-2-scope.md).

## Read in this order

1. [Product — Phase 1 scope](./product/phase-1-scope.md)
2. [Architecture overview](./architecture/00-overview.md)
3. [Folder structure](./architecture/01-folder-structure.md)
4. [Module boundaries](./architecture/02-module-boundaries.md)
5. [Authentication](./architecture/03-authentication.md)
6. [Location](./architecture/04-location.md)
7. [Design system](./architecture/05-design-system.md)
8. [Admin](./architecture/06-admin.md)
9. [API](./architecture/07-api.md)
10. [Database ERD](./database/erd.md)
11. [Security](./security/overview.md)
12. [Development workflow](./development/workflow.md)
13. [Nearby discovery performance](./development/discovery-performance.md)
14. [Sprint breakdown and development order](./product/sprint-breakdown.md)
15. [Phase 2 — Presence stories and live](./product/phase-2-scope.md)
16. [Installation, scripts, ports, and env (HTML)](./development/setup.html)

## Architecture decision records

| ADR                                                                     | Decision                                |
| ----------------------------------------------------------------------- | --------------------------------------- |
| [ADR-001](./architecture/decisions/ADR-001-modular-monolith.md)         | Modular monolith, not microservices     |
| [ADR-002](./architecture/decisions/ADR-002-otp-provider-abstraction.md) | OTP provider interface; MSG91 first     |
| [ADR-003](./architecture/decisions/ADR-003-postgis-privacy.md)          | PostGIS + approximate public location   |
| [ADR-004](./architecture/decisions/ADR-004-single-member-identity.md)   | One Member identity; roles and profiles |
| [ADR-005](./architecture/decisions/ADR-005-theme-remote-config.md)      | Admin-owned theme tokens with cache     |
| [ADR-006](./architecture/decisions/ADR-006-prisma-postgis.md)           | Prisma + SQL migrations for PostGIS     |
| [ADR-007](./architecture/decisions/ADR-007-shared-contracts.md)         | Shared types, validation, API client    |

## Implementation rule

Do not implement features from this documentation until the next stage is requested. Sprint 0 is in the repo. Each later stage must inspect the repo, plan, implement, test, and update these docs.
