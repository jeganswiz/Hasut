import { INestApplication, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";

type RedisAdapterFactory = (pub: Redis, sub: Redis) => (nsp: unknown) => unknown;

/**
 * Uses Redis so live chat rooms survive more than one API process.
 * Empty REALTIME_REDIS_URL keeps the in-process adapter.
 */
export async function attachRealtimeAdapter(
  app: INestApplication,
  redisUrl: string,
): Promise<void> {
  const origin = redisUrl.trim();
  if (origin.length === 0) {
    app.useWebSocketAdapter(new IoAdapter(app));
    return;
  }
  try {
    const loaded = (await import("@socket.io/redis-adapter")) as {
      createAdapter: RedisAdapterFactory;
    };
    const pub = new Redis(origin);
    const sub = pub.duplicate();
    app.useWebSocketAdapter(new RedisIoAdapter(app, loaded.createAdapter(pub, sub)));
  } catch (error) {
    const name = error instanceof Error ? error.name : "error";
    new Logger("RedisIoAdapter").warn(
      `Realtime Redis adapter unavailable (${name}); using in-process`,
    );
    app.useWebSocketAdapter(new IoAdapter(app));
  }
}

class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly redisAdapter: (nsp: unknown) => unknown,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.redisAdapter as Parameters<Server["adapter"]>[0]);
    return server;
  }
}
