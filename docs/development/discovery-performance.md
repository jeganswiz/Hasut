# Nearby discovery performance

`DiscoveryRepository` nearby queries are PostGIS `ST_DWithin` against `member_public_locations.geog`, `service_areas.center_geog`, and `business_locations.geog`. Geography columns use GiST indexes from the discovery migration.

On a loaded database, run:

```sql
EXPLAIN ANALYZE
SELECT m.id
FROM members m
JOIN member_public_locations mpl ON mpl.member_id = m.id
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(80.2337, 13.0418), 4326)::geography,
  mpl.geog,
  5000
)
LIMIT 50;
```

Expect an index scan on the GiST geography index, not a sequential scan of `members`. If `EXPLAIN` shows seq scan, confirm PostGIS is enabled and the GiST index exists (`\d member_public_locations`).

Do not interpolate client coordinates into SQL strings — Prisma tagged parameters only.
