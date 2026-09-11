import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { MediaModule } from "../media/media.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ReportsModule } from "../reports/reports.module";
import { MessagingController } from "./messaging.controller";
import { MessagingGateway } from "./messaging.gateway";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [ConnectionsModule, ReportsModule, MediaModule, ProfilesModule, AuthModule],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
