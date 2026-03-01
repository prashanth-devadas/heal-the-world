import { FastifyInstance } from "fastify";
import { db } from "../db/client";

export async function featureRoutes(app: FastifyInstance) {
  app.get("/features", async (_req, reply) => {
    const { data } = await db
      .from("features")
      .select("key,enabled,rollout_pct,environments");
    const flags = Object.fromEntries((data || []).map((f) => [f.key, f.enabled]));
    return reply.send(flags);
  });
}
