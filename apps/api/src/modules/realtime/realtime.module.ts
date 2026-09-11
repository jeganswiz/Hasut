import { Global, Module } from "@nestjs/common";
import { NotificationWriter } from "./notification-writer";
import { RealtimeEvents } from "./realtime.events";

@Global()
@Module({
  providers: [RealtimeEvents, NotificationWriter],
  exports: [RealtimeEvents, NotificationWriter],
})
export class RealtimeModule {}
