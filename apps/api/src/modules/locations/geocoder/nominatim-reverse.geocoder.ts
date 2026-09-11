import type { ApproximateLocation } from "@hasut/types";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { HasutHttpException } from "../../../common/errors/hasut-http.exception";
import type { ReverseGeocodeInput, ReverseGeocoder } from "./reverse-geocoder";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
}

@Injectable()
export class NominatimReverseGeocoder implements ReverseGeocoder {
  private readonly logger = new Logger(NominatimReverseGeocoder.name);

  async reverse(input: ReverseGeocodeInput): Promise<ApproximateLocation | null> {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(input.latitude));
    url.searchParams.set("lon", String(input.longitude));

    const response = await fetch(url, {
      headers: { "User-Agent": "HASUT/0.0.0 (local-discovery)" },
    });
    if (!response.ok) {
      this.logger.error(`Nominatim reverse geocode failed with status ${response.status}`);
      throw new HasutHttpException(
        "SERVICE_UNAVAILABLE",
        "Location resolution is temporarily unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const body = (await response.json()) as NominatimResponse;
    const city = body.address?.city ?? body.address?.town ?? body.address?.village ?? null;
    const region = body.address?.state ?? null;
    const country = body.address?.country ?? null;
    const countryCode = body.address?.country_code?.toUpperCase() ?? null;
    const parts = [city, region, country].filter(
      (part): part is string => part !== null && part.length > 0,
    );
    return {
      label: parts.length > 0 ? parts.join(", ") : "Approximate area",
      city,
      region,
      country,
      countryCode,
    };
  }
}
