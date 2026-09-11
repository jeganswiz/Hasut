import "reflect-metadata";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { MessagingController } from "../messaging/messaging.controller";
import { ReportsController } from "../reports/reports.controller";
import { ConnectionsController } from "./connections.controller";

describe("social route authentication", () => {
  it("keeps connection, chat, block, and report writes authenticated", () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ConnectionsController.prototype.request),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, ConnectionsController.prototype.accept),
    ).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MessagingController.prototype.send)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ReportsController.prototype.block)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ReportsController.prototype.report)).toBeUndefined();
  });
});
