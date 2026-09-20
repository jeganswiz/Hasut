import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { AudioLibraryService } from "./audio-library.service";
import { LiveService } from "./live.service";
import { PatronsService } from "./patrons.service";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";

@Module({
  imports: [MediaModule],
  controllers: [StoriesController],
  providers: [StoriesService, LiveService, AudioLibraryService, PatronsService],
  exports: [StoriesService, LiveService, AudioLibraryService, PatronsService],
})
export class StoriesModule {}
