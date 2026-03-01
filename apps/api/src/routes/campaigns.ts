import { FastifyInstance } from "fastify";
import { db } from "../db/client";

const STATUS_VALUES = ["active","triggered","voting","funded","refundable","expired"] as const;

export async function campaignRoutes(app: FastifyInstance) {
  app.get("/campaigns", async (req, reply) => {
    const query = req.query as Record<string, string>;
    let q = db.from("campaigns").select("*").order("created_at", { ascending: false });
    if (query.status && STATUS_VALUES.includes(query.status as typeof STATUS_VALUES[number])) {
      q = q.eq("status", query.status);
    }
    if (query.type) q = q.eq("type", query.type);
    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data: data || [] });
  });

  app.get("/campaigns/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await db
      .from("campaigns")
      .select("*, institutions(*)")
      .eq("id", id)
      .single();
    if (error || !data) return reply.status(404).send({ error: "Campaign not found" });
    return reply.send({ data });
  });

  app.get("/campaigns/:id/donations", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await db
      .from("donations")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data: data || [] });
  });

  app.get("/campaigns/:id/votes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await db
      .from("dao_votes")
      .select("*")
      .eq("campaign_id", id);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ data: data || [] });
  });
}
