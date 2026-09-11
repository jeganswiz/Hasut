import type { ApproximateLocation } from "@hasut/types";

export interface ReverseGeocodeInput {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocoder {
  reverse(input: ReverseGeocodeInput): Promise<ApproximateLocation | null>;
}

export const REVERSE_GEOCODER = Symbol("REVERSE_GEOCODER");
