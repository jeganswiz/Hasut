import { Global, Module } from "@nestjs/common";
import { ConfigurationController } from "./configuration.controller";
import { ConfigurationService } from "./configuration.service";

@Global()
@Module({
  controllers: [ConfigurationController],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
