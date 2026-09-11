import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface GeoRow {
  latitude: number;
  longitude: number;
}

@Injectable()
export class LocationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async writeExactPoint(memberId: string, longitude: number, latitude: number): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE member_locations
        SET geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        WHERE member_id = ${memberId}::uuid
      `,
    );
  }

  async writeApproximatePoint(
    memberId: string,
    longitude: number,
    latitude: number,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE member_public_locations
        SET approx_geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        WHERE member_id = ${memberId}::uuid
      `,
    );
  }

  async readExactPoint(memberId: string): Promise<GeoRow | null> {
    const rows = await this.prisma.$queryRaw<GeoRow[]>(
      Prisma.sql`
        SELECT ST_Y(geog::geometry) AS latitude, ST_X(geog::geometry) AS longitude
        FROM member_locations
        WHERE member_id = ${memberId}::uuid AND geog IS NOT NULL
      `,
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
  }

  async writeServiceAreaCenter(
    professionalProfileId: string,
    longitude: number,
    latitude: number,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE service_areas
        SET center_geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        WHERE professional_profile_id = ${professionalProfileId}::uuid
      `,
    );
  }

  async readServiceAreaCenter(professionalProfileId: string): Promise<GeoRow | null> {
    const rows = await this.prisma.$queryRaw<GeoRow[]>(
      Prisma.sql`
        SELECT ST_Y(center_geog::geometry) AS latitude, ST_X(center_geog::geometry) AS longitude
        FROM service_areas
        WHERE professional_profile_id = ${professionalProfileId}::uuid AND center_geog IS NOT NULL
      `,
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
  }

  async writeBusinessPoint(businessId: string, longitude: number, latitude: number): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE business_locations
        SET geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        WHERE business_id = ${businessId}::uuid
      `,
    );
  }

  async readBusinessPoint(businessId: string): Promise<GeoRow | null> {
    const rows = await this.prisma.$queryRaw<GeoRow[]>(
      Prisma.sql`
        SELECT ST_Y(geog::geometry) AS latitude, ST_X(geog::geometry) AS longitude
        FROM business_locations
        WHERE business_id = ${businessId}::uuid AND geog IS NOT NULL
      `,
    );
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { latitude: Number(row.latitude), longitude: Number(row.longitude) };
  }
}
