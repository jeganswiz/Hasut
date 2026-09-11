import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LocationsModule } from "../locations/locations.module";
import { MediaModule } from "../media/media.module";
import { DiscoveryController } from "./discovery.controller";
import { DiscoveryGateway } from "./discovery.gateway";
import { DiscoveryRepository } from "./discovery.repository";
import { DiscoveryService } from "./discovery.service";

@Module({
  imports: [LocationsModule, MediaModule, AuthModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DiscoveryRepository, DiscoveryGateway],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
