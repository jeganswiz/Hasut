import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { ReportsModule } from "../reports/reports.module";
import { StoriesModule } from "../stories/stories.module";
import { MediaModule } from "../media/media.module";
import { LiveChatService } from "./live-chat.service";
import { LiveController } from "./live.controller";
import { LiveDiscoverService } from "./live-discover.service";
import { LiveGateway } from "./live.gateway";
import { LiveHealthService } from "./live-health.service";
import { LiveLifecycleWorker } from "./live-lifecycle.worker";
import { LiveMetricsService } from "./live-metrics.service";
import { LiveRecordingService } from "./live-recording.service";

@Module({
  imports: [StoriesModule, AuthModule, ProfilesModule, ReportsModule, MediaModule],
  controllers: [LiveController],
  providers: [
    LiveHealthService,
    LiveLifecycleWorker,
    LiveChatService,
    LiveGateway,
    LiveDiscoverService,
    LiveRecordingService,
    LiveMetricsService,
  ],
  exports: [LiveHealthService, LiveChatService, LiveDiscoverService, LiveMetricsService],
})
export class LiveModule {}
