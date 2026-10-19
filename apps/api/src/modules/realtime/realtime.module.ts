import { Global, Module } from "@nestjs/common";
import { LiveViewerRegistry } from "./live-viewer-registry";
import { NotificationWriter } from "./notification-writer";
import { PushDispatchService } from "./push-dispatch.service";
import { RealtimeEvents } from "./realtime.events";

@Global()
@Module({
  providers: [RealtimeEvents, NotificationWriter, LiveViewerRegistry, PushDispatchService],
  exports: [RealtimeEvents, NotificationWriter, LiveViewerRegistry, PushDispatchService],
})
export class RealtimeModule {}
