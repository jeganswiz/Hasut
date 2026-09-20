import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { LiveService } from "./live.service";
import { StoriesController } from "./stories.controller";
import { StoriesService } from "./stories.service";

@Module({
  imports: [MediaModule],
  controllers: [StoriesController],
  providers: [StoriesService, LiveService],
  exports: [StoriesService, LiveService],
})
export class StoriesModule {}
