import { ConfigService } from "@nestjs/config";
import type { Provider } from "@nestjs/common";
import type { ApiEnv } from "../../../config/env";
import { MEDIA_STORAGE } from "./media-storage";
import { MemoryMediaStorage } from "./memory-media.storage";
import { S3MediaStorage } from "./s3-media.storage";

export const mediaStorageFactory: Provider = {
  provide: MEDIA_STORAGE,
  inject: [ConfigService],
  useFactory: (config: ConfigService<ApiEnv, true>) => {
    if (config.get("MEDIA_STORAGE", { infer: true }) === "s3") {
      return new S3MediaStorage(config);
    }
    return new MemoryMediaStorage();
  },
};
