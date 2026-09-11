# ADR-006: Prisma plus SQL migrations for PostGIS

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Prisma is the mandated ORM. Native PostGIS `geography` support is limited.

## Decision

Prisma remains the schema source for relational models. Geography columns, GiST indexes, and nearby queries are defined in SQL migrations and isolated repository helpers using parameterized raw SQL. No MongoDB.

## Consequences

- Developers must not scatter `$queryRaw` outside location/discovery repositories.
- Schema review includes SQL migration files, not only `schema.prisma`.
