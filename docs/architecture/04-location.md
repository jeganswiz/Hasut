# Location architecture

## Goals

- Nearby, radius, and service-area queries that are fast enough for a map.
- Distance used in ranking and display.
- **Never expose exact personal location by default.**
- Business locations may be public when the owner opts in (business entity, not a person’s home).

## Storage

PostgreSQL + PostGIS.

| Data                        | Type                                                   | Visibility                                        |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Member exact point          | `geography(Point, 4326)` on `member_locations`         | Private to member + authorized support with audit |
| Member public approximation | derived point or cell                                  | Discovery and peer profiles                       |
| Professional service area   | `geography(Polygon, 4326)` and/or center+radius meters | Public as area, not as a pin of the person        |
| Business location           | `geography(Point, 4326)`                               | Public when business is listed                    |

Indexes: GiST on all geography columns used in `ST_DWithin`.

Prisma does not model PostGIS richly. Geography columns are created in SQL migrations and referenced as `Unsupported("geography")` (or equivalent) in Prisma. Distance queries use parameterized `$queryRaw` helpers inside `locations` / `discovery` repositories only.

## Public location policy

Exact WGS84 of a member is **write-only for matching**. Read models:

1. **Snap to grid** (cell size from discovery config, e.g. 300–500 m) or reduced geohash precision.
2. APIs return `approximateLocation` as `{ label, distanceBucket }` not `{ lat, lng }` for people.
3. Distance is bucketed for people (`200m`, `800m`, `1.1km`) using `packages/utils` so clients cannot reverse-engineer a point from many queries easily. Rate-limit discovery anyway.
4. Map markers for people use jittered or cell-centered coordinates generated server-side, never the stored exact point.
5. Business markers may use the stored business point.

Clients must not send “display coordinates” that override server policy.

## Queries

| Use                 | PostGIS                                                           |
| ------------------- | ----------------------------------------------------------------- |
| Nearby              | `ST_DWithin(geog, origin, radius_m)`                              |
| Distance for rank   | `ST_Distance(geog, origin)`                                       |
| Inside service area | `ST_Covers(area, origin)` or `ST_DWithin(center, origin, radius)` |
| Bounding map        | radius from viewport center, max radius from config               |

Origin for “near me” is the **requesting member’s exact stored point**, used only inside the database. It is not echoed in the response.

## Movement gate and live presence

Clients watch GPS locally. They **accept** a new origin only when:

1. Distance from the last accepted fix is at least `location.policy.significantMoveMeters` (default equals the snap cell, 400 m), and
2. At least `location.policy.minUpdateIntervalSeconds` has elapsed (default 120 seconds).

The first fix is always accepted. GPS jitter updates only the viewer’s own overlay; it does not `PUT /me/location` or refetch nearby.

Signed-in `PUT /me/location` uses the same rules on the server. A move below the threshold is a no-op. A real move inside the interval returns `RATE_LIMITED`. After a successful write, the API publishes `presence.updated` to snapped **cell rooms** (plus neighbors covering the default discovery radius). The payload is a `DiscoveryMarker` (`pinLat` / `pinLng` only). Exact coordinates are never broadcast.

Guests stay REST-only. Nearby list ranking refreshes on origin-cell change, filter change, or the same TTL as `minUpdateIntervalSeconds`.

WebSocket: authenticated `/ws/v1/discovery`. Clients emit `presence.sync` after a location write so they join the new cell neighborhood.

## Discovery basemap

Leaflet on web uses a three-layer raster chain from configuration, not a hardcoded Carto URL in the map component:

1. **MapTiler Dataviz** when `MAPTILER_API_KEY` is set (admin can still select it as primary).
2. **Stadia Alidade Smooth** (`STADIA_API_KEY` optional).
3. **CARTO Positron** as last resort.

`GET /api/v1/config/discovery` returns `mapProvider`, resolved `mapTileUrl`, `mapFallbackTileUrls` (up to two), and `mapAttribution`. The web map switches URL on Leaflet `tileerror`. Admins set `mapProvider` and an optional custom XYZ template (`{z}/{x}/{y}`) on `PATCH /api/v1/admin/discovery/policy`. Pins, clusters, and snap policy are unchanged.

## Service area

A professional sets:

- center (may be approximate publicly) + radius meters, and/or
- polygon (admin-enabled later; Phase 1 can ship radius-first)

Discovery of professionals: requester’s exact point must fall in the professional’s service area **or** the professional’s public presence is within search radius — ranking weights decide. Exact rule is configuration, not hardcoded.

## Multi-city later

Store `locality_id` nullable on locations in Phase 1 so city catalogs can attach later. Do not build city ops tooling now.

## Module API (internal)

`locations` exposes:

- `setMemberExactLocation(memberId, point)` — member only
- `getPublicLocation(memberId)` — approximation
- `setServiceArea(professionalId, area)`
- `distanceMeters(a, b)` — server use
- `membersWithin(origin, radius)` — returns IDs + bucketed distance, not points
