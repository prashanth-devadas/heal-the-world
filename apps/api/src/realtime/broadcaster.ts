import Redis from "ioredis";
import { config } from "../config";

let sub: Redis | null = null;
const clients = new Set<(data: string) => void>();

export function getSubscriber(): Redis {
  if (!sub) {
    sub = new Redis(config.redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    sub.on("connect", () => {
      sub!.subscribe("campaign:updates", "prediction:new").catch(() => {});
    });
    sub.on("message", (_channel: string, message: string) => {
      clients.forEach((send) => {
        try { send(message); } catch {}
      });
    });
    sub.on("error", () => {}); // suppress offline errors
  }
  return sub;
}

export function addClient(send: (data: string) => void) {
  clients.add(send);
  return () => clients.delete(send);
}
