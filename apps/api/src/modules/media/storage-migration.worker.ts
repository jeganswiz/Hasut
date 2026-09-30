import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ApiEnv } from "../../config/env";
import { StorageMigrationService } from "./storage-migration.service";

const TICK_MS = 2_000;

@Injectable()
export class StorageMigrationWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly migration: StorageMigrationService,
    private readonly config: ConfigService<ApiEnv, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get("NODE_ENV", { infer: true }) === "test") {
      return;
    }
    this.timer = setInterval(() => {
      void this.migration.processBatch();
    }, TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
