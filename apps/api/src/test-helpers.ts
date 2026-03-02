import Fastify from "fastify";
import cors from "@fastify/cors";
import { campaignRoutes } from "./routes/campaigns";
import { featureRoutes } from "./routes/features";
import { oracleEventRoutes } from "./routes/oracleEvents";

export async function build() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(campaignRoutes, { prefix: "/api/v1" });
  await app.register(featureRoutes, { prefix: "/api/v1" });
  await app.register(oracleEventRoutes, { prefix: "/api/v1" });
  app.get("/health", async () => ({ status: "ok" }));
  await app.ready();
  return app;
}
