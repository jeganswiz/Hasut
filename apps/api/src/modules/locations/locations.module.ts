import { Module } from "@nestjs/common";
import { reverseGeocoderFactory } from "./geocoder/reverse-geocoder.factory";
import { LocationsController } from "./locations.controller";
import { LocationsRepository } from "./locations.repository";
import { LocationsService } from "./locations.service";

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, LocationsRepository, reverseGeocoderFactory],
  exports: [LocationsService, LocationsRepository, reverseGeocoderFactory],
})
export class LocationsModule {}
