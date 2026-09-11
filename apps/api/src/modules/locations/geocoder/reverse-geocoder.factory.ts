import { ConfigService } from "@nestjs/config";
import type { Provider } from "@nestjs/common";
import type { ApiEnv } from "../../../config/env";
import { ConsoleReverseGeocoder } from "./console-reverse.geocoder";
import { NominatimReverseGeocoder } from "./nominatim-reverse.geocoder";
import { REVERSE_GEOCODER } from "./reverse-geocoder";

export const reverseGeocoderFactory: Provider = {
  provide: REVERSE_GEOCODER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>) => {
    if (config.get("GEOCODER_PROVIDER", { infer: true }) === "nominatim") {
      return new NominatimReverseGeocoder();
    }
    return new ConsoleReverseGeocoder();
  },
};
