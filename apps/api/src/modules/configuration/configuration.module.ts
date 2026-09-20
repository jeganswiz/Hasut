import { Global, Module } from "@nestjs/common";
import { AdminConfigController } from "./admin-config.controller";
import { ConfigurationController } from "./configuration.controller";
import { ConfigurationService } from "./configuration.service";

@Global()
@Module({
  controllers: [ConfigurationController, AdminConfigController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
