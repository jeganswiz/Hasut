import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { mediaStorageFactory } from "./storage/media-storage.factory";

@Module({
  controllers: [MediaController],
  providers: [MediaService, mediaStorageFactory],
  exports: [MediaService],
})
export class MediaModule {}
