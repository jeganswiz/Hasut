# ADR-001: Modular monolith, not microservices

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

HASUT will eventually span discovery, messaging, marketplace, billing, and more. Microservices are often proposed early for that reason.

## Decision

Phase 1 is a **single NestJS application** with modules and a directed dependency graph. One PostgreSQL database. One deployable API.

## Consequences

- Faster iteration, single transaction for connection+conversation creation, simpler auth.
- Module boundaries must be enforced so a later extract (e.g. messaging) is possible.
- Scaling is vertical and read-replica first, not service-split first.
