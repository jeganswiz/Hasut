# ADR-003: PostGIS with approximate public location

- **Status:** Accepted
- **Date:** 2026-09-04

## Context

Nearby search needs real geography. Exposing exact personal coordinates would violate privacy and enable stalking.

## Decision

Store exact `geography(Point,4326)` for members privately. Derive a snapped public point and human label. Public APIs return distance buckets and labels, not personal lat/lng. Business listing coordinates may be public. GiST indexes support `ST_DWithin`.

## Consequences

- Discovery SQL is slightly more complex.
- Ranking uses true distance server-side without leaking it as a coordinate.
- Cell size is configurable; smaller cells leak more.
