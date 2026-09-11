import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { MediaModule } from "../media/media.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryRepository } from "./discovery.repository";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [LocationsModule, MediaModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DiscoveryRepository],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
