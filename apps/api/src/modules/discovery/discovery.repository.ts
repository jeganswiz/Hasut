import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface NearbyRow {
  id: string;
  kind: "MEMBER" | "PROFESSIONAL" | "BUSINESS";
  title: string;
  subtitle: string;
  photoMediaId: string | null;
  categoryLabel: string | null;
  categoryIds: string[];
  availability: string | null;
  modeCode: string | null;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  distanceMeters: number;
  pinLat: number;
  pinLng: number;
  updatedAt: Date;
  locationLabel: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

@Injectable()
export class DiscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findNearbyMembers(input: {
    longitude: number;
    latitude: number;
    radiusMeters: number;
    viewerId: string | null;
    query: string | null;
  }): Promise<NearbyRow[]> {
    const origin = this.originSql(input.longitude, input.latitude);
    const exclude =
      input.viewerId === null ? Prisma.empty : Prisma.sql`AND m.id <> ${input.viewerId}::uuid`;
    const search =
      input.query === null
        ? Prisma.empty
        : Prisma.sql`AND (p.display_name ILIKE ${"%" + input.query + "%"} OR p.bio ILIKE ${"%" + input.query + "%"})`;
    return this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        m.id,
        'MEMBER'::text AS kind,
        p.display_name AS title,
        COALESCE(cm.label, p.status_text, '') AS subtitle,
        p.photo_media_id AS "photoMediaId",
        NULL::text AS "categoryLabel",
        ARRAY[]::text[] AS "categoryIds",
        NULL::text AS availability,
        cm.code AS "modeCode",
        false AS verified,
        ra.avg_rating AS rating,
        COALESCE(ra.count, 0) AS "reviewCount",
        ST_Distance(pl.approx_geog, ${origin}) AS "distanceMeters",
        ST_Y(pl.approx_geog::geometry) AS "pinLat",
        ST_X(pl.approx_geog::geometry) AS "pinLng",
        p.updated_at AS "updatedAt",
        pl.label AS "locationLabel",
        pl.city,
        pl.region,
        pl.country,
        pl.country_code AS "countryCode"
      FROM members m
      JOIN profiles p ON p.member_id = m.id
      JOIN member_locations ml ON ml.member_id = m.id
      JOIN member_public_locations pl ON pl.member_id = m.id
      LEFT JOIN current_modes cm ON cm.id = p.current_mode_id
      LEFT JOIN review_aggregates ra
        ON ra.subject_id = m.id AND ra.subject_type = 'MEMBER'
      WHERE m.status = 'ACTIVE'
        AND p.is_discoverable = true
        AND ml.permission = 'GRANTED'
        AND pl.approx_geog IS NOT NULL
        AND ST_DWithin(pl.approx_geog, ${origin}, ${input.radiusMeters})
        ${exclude}
        ${search}
    `);
  }

  async findNearbyProfessionals(input: {
    longitude: number;
    latitude: number;
    radiusMeters: number;
    viewerId: string | null;
    query: string | null;
    match: "service_area" | "presence" | "either";
  }): Promise<NearbyRow[]> {
    const origin = this.originSql(input.longitude, input.latitude);
    const exclude =
      input.viewerId === null
        ? Prisma.empty
        : Prisma.sql`AND pp.member_id <> ${input.viewerId}::uuid`;
    const search =
      input.query === null
        ? Prisma.empty
        : Prisma.sql`AND (
            pp.headline ILIKE ${"%" + input.query + "%"}
            OR p.display_name ILIKE ${"%" + input.query + "%"}
            OR EXISTS (
              SELECT 1 FROM professional_skills ps
              WHERE ps.professional_profile_id = pp.id AND ps.label ILIKE ${"%" + input.query + "%"}
            )
          )`;
    const geo =
      input.match === "service_area"
        ? Prisma.sql`ST_DWithin(${origin}, sa.center_geog, sa.radius_meters)`
        : input.match === "presence"
          ? Prisma.sql`ST_DWithin(sa.center_geog, ${origin}, ${input.radiusMeters})`
          : Prisma.sql`(
              ST_DWithin(${origin}, sa.center_geog, sa.radius_meters)
              OR ST_DWithin(sa.center_geog, ${origin}, ${input.radiusMeters})
            )`;
    return this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        pp.id,
        'PROFESSIONAL'::text AS kind,
        COALESCE(NULLIF(pp.headline, ''), p.display_name, 'Professional') AS title,
        COALESCE(p.display_name, '') AS subtitle,
        p.photo_media_id AS "photoMediaId",
        (
          SELECT c.name FROM professional_categories pc
          JOIN categories c ON c.id = pc.category_id
          WHERE pc.professional_profile_id = pp.id
          ORDER BY c.sort_order ASC
          LIMIT 1
        ) AS "categoryLabel",
        COALESCE((
          SELECT array_agg(pc.category_id::text)
          FROM professional_categories pc
          WHERE pc.professional_profile_id = pp.id
        ), ARRAY[]::text[]) AS "categoryIds",
        pp.availability,
        NULL::text AS "modeCode",
        (pp.identity_verification_status = 'VERIFIED') AS verified,
        ra.avg_rating AS rating,
        COALESCE(ra.count, 0) AS "reviewCount",
        ST_Distance(sa.center_geog, ${origin}) AS "distanceMeters",
        ST_Y(sa.center_geog::geometry) AS "pinLat",
        ST_X(sa.center_geog::geometry) AS "pinLng",
        pp.updated_at AS "updatedAt",
        sa.label AS "locationLabel",
        sa.city,
        sa.region,
        sa.country,
        sa.country_code AS "countryCode"
      FROM professional_profiles pp
      JOIN members m ON m.id = pp.member_id
      JOIN service_areas sa ON sa.professional_profile_id = pp.id
      LEFT JOIN profiles p ON p.member_id = pp.member_id
      LEFT JOIN review_aggregates ra
        ON ra.subject_id = pp.id AND ra.subject_type = 'PROFESSIONAL'
      WHERE m.status = 'ACTIVE'
        AND pp.status = 'ACTIVE'
        AND sa.center_geog IS NOT NULL
        AND ${geo}
        ${exclude}
        ${search}
    `);
  }

  async findNearbyBusinesses(input: {
    longitude: number;
    latitude: number;
    radiusMeters: number;
    query: string | null;
  }): Promise<NearbyRow[]> {
    const origin = this.originSql(input.longitude, input.latitude);
    const search =
      input.query === null
        ? Prisma.empty
        : Prisma.sql`AND (b.name ILIKE ${"%" + input.query + "%"} OR b.description ILIKE ${"%" + input.query + "%"})`;
    return this.prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
      SELECT
        b.id,
        'BUSINESS'::text AS kind,
        b.name AS title,
        COALESCE(b.description, '') AS subtitle,
        b.cover_media_id AS "photoMediaId",
        (
          SELECT c.name FROM business_categories bc
          JOIN categories c ON c.id = bc.category_id
          WHERE bc.business_id = b.id
          ORDER BY c.sort_order ASC
          LIMIT 1
        ) AS "categoryLabel",
        COALESCE((
          SELECT array_agg(bc.category_id::text)
          FROM business_categories bc
          WHERE bc.business_id = b.id
        ), ARRAY[]::text[]) AS "categoryIds",
        NULL::text AS availability,
        NULL::text AS "modeCode",
        (b.verification_status = 'VERIFIED') AS verified,
        ra.avg_rating AS rating,
        COALESCE(ra.count, 0) AS "reviewCount",
        ST_Distance(bl.geog, ${origin}) AS "distanceMeters",
        ST_Y(bl.geog::geometry) AS "pinLat",
        ST_X(bl.geog::geometry) AS "pinLng",
        b.updated_at AS "updatedAt",
        bl.label AS "locationLabel",
        bl.city,
        bl.region,
        bl.country,
        bl.country_code AS "countryCode"
      FROM businesses b
      JOIN business_locations bl ON bl.business_id = b.id
      LEFT JOIN review_aggregates ra
        ON ra.subject_id = b.id AND ra.subject_type = 'BUSINESS'
      WHERE b.status = 'ACTIVE'
        AND bl.is_public = true
        AND bl.geog IS NOT NULL
        AND ST_DWithin(bl.geog, ${origin}, ${input.radiusMeters})
        ${search}
    `);
  }

  private originSql(longitude: number, latitude: number): Prisma.Sql {
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
  }
}
