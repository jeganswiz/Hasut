import { Module } from "@nestjs/common";
import { ProfilesModule } from "../profiles/profiles.module";
import { ConnectionsController } from "./connections.controller";
import { ConnectionsService } from "./connections.service";

@Module({
  imports: [ProfilesModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
