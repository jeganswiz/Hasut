import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaDelivery } from "./media-delivery";
import { MediaService } from "./media.service";
import { StorageAdminController } from "./storage-admin.controller";
import { StorageAdminService } from "./storage-admin.service";
import { StorageMigrationService } from "./storage-migration.service";
import { StorageMigrationWorker } from "./storage-migration.worker";
import { StorageRegistry } from "./storage/storage-registry.service";

@Module({
  controllers: [MediaController, StorageAdminController],
  providers: [
    MediaService,
    MediaDelivery,
    StorageRegistry,
    StorageAdminService,
    StorageMigrationService,
    StorageMigrationWorker,
  ],
  exports: [MediaService, MediaDelivery],
})
export class MediaModule {}
