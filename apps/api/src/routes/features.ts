import { FastifyInstance } from "fastify";
import { db } from "../db/client";

export async function featureRoutes(app: FastifyInstance) {
  app.get("/features", async (_req, reply) => {
    const { data } = await db
      .from("features")
      .select("key,enabled,rollout_pct,environments");
    return reply.send({ data: data || [] });
  });
}
