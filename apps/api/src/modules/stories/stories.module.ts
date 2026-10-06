import { Module } from "@nestjs/common";
import { ConnectionsModule } from "../connections/connections.module";
import { MediaModule } from "../media/media.module";
import { MessagingModule } from "../messaging/messaging.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { AudioLibraryService } from "./audio-library.service";
import { LiveService } from "./live.service";
import { PatronsService } from "./patrons.service";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";
import { StoryReactionsService } from "./story-reactions.service";
import { FfmpegStoryTranscoder, STORY_TRANSCODER } from "./story-transcoder";
import { StoryPlaybackService } from "./story-playback.service";
import { StoryPlaybackWorker } from "./story-playback.worker";

@Module({
  imports: [MediaModule, ConnectionsModule, MessagingModule, ProfilesModule],
  controllers: [StoriesController],
  providers: [
    StoriesService,
    StoryReactionsService,
    LiveService,
    AudioLibraryService,
    PatronsService,
    StoryPlaybackService,
    StoryPlaybackWorker,
    { provide: STORY_TRANSCODER, useClass: FfmpegStoryTranscoder },
  ],
  exports: [StoriesService, LiveService, AudioLibraryService, PatronsService],
})
export class StoriesModule {}
