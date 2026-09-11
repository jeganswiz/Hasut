import type { ApproximateLocation } from "@hasut/types";
import { haversineMeters } from "@hasut/utils";
import { Injectable } from "@nestjs/common";
import type { ReverseGeocodeInput, ReverseGeocoder } from "./reverse-geocoder";

interface KnownPlace {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

const KNOWN_PLACES: readonly KnownPlace[] = [
  {
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
    countryCode: "IN",
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    city: "Mumbai",
    region: "Maharashtra",
    country: "India",
    countryCode: "IN",
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    city: "Delhi",
    region: "Delhi",
    country: "India",
    countryCode: "IN",
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    city: "Chennai",
    region: "Tamil Nadu",
    country: "India",
    countryCode: "IN",
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    city: "Hyderabad",
    region: "Telangana",
    country: "India",
    countryCode: "IN",
    latitude: 17.385,
    longitude: 78.4867,
  },
];

const MATCH_RADIUS_METERS = 80_000;

@Injectable()
export class ConsoleReverseGeocoder implements ReverseGeocoder {
  async reverse(input: ReverseGeocodeInput): Promise<ApproximateLocation | null> {
    let nearest: KnownPlace | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const place of KNOWN_PLACES) {
      const distance = haversineMeters(input, place);
      if (distance < nearestDistance) {
        nearest = place;
        nearestDistance = distance;
      }
    }
    if (nearest === null || nearestDistance > MATCH_RADIUS_METERS) {
      return {
        label: "Approximate area",
        city: null,
        region: null,
        country: null,
        countryCode: null,
      };
    }
    return {
      label: `${nearest.city}, ${nearest.region}, ${nearest.country}`,
      city: nearest.city,
      region: nearest.region,
      country: nearest.country,
      countryCode: nearest.countryCode,
    };
  }
}
