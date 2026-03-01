import Redis from "ioredis";
import { db } from "../db/client";
import { config } from "../config";

export function startProposalListener() {
  const sub = new Redis(config.redisUrl, { lazyConnect: true, enableOfflineQueue: false });

  sub.on("connect", () => {
    sub.subscribe("campaign:proposals").catch(() => {});
  });

  sub.on("message", async (_channel: string, message: string) => {
    try {
      const proposal = JSON.parse(message);
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + (proposal.campaign_deadline_days || 21));

      const lng = proposal.bbox[0] + (proposal.bbox[2] - proposal.bbox[0]) / 2;
      const lat = proposal.bbox[1] + (proposal.bbox[3] - proposal.bbox[1]) / 2;

      const { error } = await db.from("campaigns").insert({
        type: proposal.type,
        region_name: proposal.region,
        bbox: proposal.bbox,
        centroid: `POINT(${lng} ${lat})`,
        status: "active",
        confidence: proposal.confidence,
        severity: proposal.severity,
        fundraising_target_usd: proposal.fundraising_target_usd,
        campaign_deadline: deadline.toISOString(),
        oracle_sources: proposal.oracle_sources,
      });

      if (error) console.error("Failed to create campaign:", error.message);
      else console.log(`Campaign created: ${proposal.region}`);
    } catch (e) {
      console.error("Proposal listener error:", e);
    }
  });

  sub.on("error", () => {}); // suppress offline errors
  sub.connect().catch(() => {});
}
