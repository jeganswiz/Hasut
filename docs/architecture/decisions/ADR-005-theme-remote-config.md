# ADR-005: Admin-owned theme with cached delivery

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Brand (purple primary, gold ratings, radii) must be tunable without deploys. Reading Postgres on every React render is unacceptable.

## Decision

Theme tokens live in `theme_configs`. Clients consume `GET /config/theme` via `packages/config` with Redis + HTTP cache + client TTL. Components use token names from `packages/ui` only. Publish busts cache and writes an audit log.

## Consequences

- Admin can change primary/secondary/accent/background/surface/text/logo.
- Contrast may degrade; admin warns on publish.
- Boot fallback tokens exist only for first paint.
