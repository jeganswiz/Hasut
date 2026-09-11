import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

export interface RealtimeFanout {
  memberIds: string[];
  event: string;
  payload: unknown;
}

@Injectable()
export class RealtimeEvents {
  private readonly bus = new EventEmitter();

  publish(memberIds: string[], event: string, payload: unknown): void {
    this.bus.emit("fanout", { memberIds, event, payload } satisfies RealtimeFanout);
  }

  subscribe(handler: (event: RealtimeFanout) => void): void {
    this.bus.on("fanout", handler);
  }
}
