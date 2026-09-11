import type { TokenStorage } from "@hasut/auth";
import { io, type Socket } from "socket.io-client";

export interface HasutRealtimeOptions {
  baseUrl: string;
  tokenStorage: TokenStorage;
  reconnectMs?: number;
}

export class HasutRealtimeClient {
  private socket: Socket | null = null;

  constructor(private readonly options: HasutRealtimeOptions) {}

  async connect(): Promise<Socket> {
    if (this.socket !== null) {
      if (!this.socket.connected) {
        await this.applyAuth(this.socket);
        this.socket.connect();
      }
      return this.socket;
    }
    const reconnectMs = this.options.reconnectMs ?? 2_000;
    const socket = io(`${this.options.baseUrl.replace(/\/$/, "")}/ws/v1/messaging`, {
      auth: { token: (await this.options.tokenStorage.getAccessToken()) ?? "" },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: reconnectMs,
      reconnectionDelayMax: reconnectMs * 4,
    });
    socket.io.on("reconnect_attempt", () => {
      void this.applyAuth(socket);
    });
    this.socket = socket;
    return socket;
  }

  async reconnect(): Promise<Socket> {
    this.disconnect();
    return this.connect();
  }

  on(event: string, handler: (payload: unknown) => void): void {
    this.socket?.on(event, handler);
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private async applyAuth(socket: Socket): Promise<void> {
    const token = (await this.options.tokenStorage.getAccessToken()) ?? "";
    socket.auth = { token };
  }
}

export function createHasutRealtimeClient(options: HasutRealtimeOptions): HasutRealtimeClient {
  return new HasutRealtimeClient(options);
}
