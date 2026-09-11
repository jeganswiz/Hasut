# ADR-007: Shared contracts across web, mobile, and admin

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Three clients plus one API will otherwise drift (duplicate types, ad-hoc fetch, mismatched validation).

## Decision

`packages/types`, `packages/validation`, and `packages/api-client` are the only contract layer. Apps do not define parallel DTOs or API modules. Auth storage differs by platform inside `packages/auth` adapters. The API client uses Axios as the single HTTP implementation for web, admin, and mobile.

## Consequences

- API changes are package changes.
- Slightly more ceremony for the first endpoint; far less drift later.
