import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../connections/connections.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [ConnectionsModule, ProfilesModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
