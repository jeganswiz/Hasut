import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

export interface RealtimeFanout {
  memberIds: string[];
  event: string;
  payload: unknown;
}

export interface CellFanout {
  cellIds: string[];
  event: string;
  payload: unknown;
}

export interface RoomFanout {
  room: string;
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

  publishCells(cellIds: string[], event: string, payload: unknown): void {
    this.bus.emit("cells", { cellIds, event, payload } satisfies CellFanout);
  }

  subscribeCells(handler: (event: CellFanout) => void): void {
    this.bus.on("cells", handler);
  }

  publishRoom(room: string, event: string, payload: unknown): void {
    this.bus.emit("rooms", { room, event, payload } satisfies RoomFanout);
  }

  subscribeRooms(handler: (event: RoomFanout) => void): void {
    this.bus.on("rooms", handler);
  }
}
