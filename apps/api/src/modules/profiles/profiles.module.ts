import { Module } from "@nestjs/common";
import { LocationsModule } from "../locations/locations.module";
import { MediaModule } from "../media/media.module";
import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";

@Module({
  imports: [LocationsModule, MediaModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
