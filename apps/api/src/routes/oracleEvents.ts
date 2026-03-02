import { FastifyInstance } from "fastify";

const SEVERITY_THRESHOLDS: Record<string, [number, string][]> = {
  earthquake: [[7.5, "critical"], [6.5, "high"], [5.5, "medium"], [0.0, "low"]],
  hurricane:  [[4.0, "critical"], [3.0, "high"], [2.0, "medium"], [0.0, "low"]],
  default:    [[0.9, "critical"], [0.75, "high"], [0.55, "medium"], [0.0, "low"]],
};

function getSeverity(eventType: string, magnitude: number): string {
  const thresholds = SEVERITY_THRESHOLDS[eventType] ?? SEVERITY_THRESHOLDS.default;
  for (const [threshold, label] of thresholds) {
    if (magnitude >= threshold) return label;
  }
  return "low";
}

interface OracleEventRow {
  id: string;
  event_type: string;
  region: string;
  status: "active";
  severity: string;
  confidence: number;
  fundraising_target_usd: number;
  raised_eth: number;
  bbox: [number, number, number, number];
  oracle_sources: string[];
  created_at: string;
  predicted: true;
}

async function fetchUSGS(): Promise<OracleEventRow[]> {
  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson"
    );
    if (!res.ok) return [];
    const json = await res.json() as { features: any[] };
    return (json.features ?? []).map((f: any) => {
      const mag: number = f.properties.mag ?? 0;
      const sig: number = Math.min((f.properties.sig ?? 0) / 1000, 1.0);
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const delta = 1.0;
      return {
        id: `usgs-${f.id}`,
        event_type: "earthquake",
        region: f.properties.place ?? "Unknown region",
        status: "active" as const,
        severity: getSeverity("earthquake", mag),
        confidence: sig,
        fundraising_target_usd: 0,
        raised_eth: 0,
        bbox: [lng - delta, lat - delta, lng + delta, lat + delta] as [number, number, number, number],
        oracle_sources: ["USGS"],
        created_at: new Date(f.properties.time ?? Date.now()).toISOString(),
        predicted: true as const,
      };
    });
  } catch {
    return [];
  }
}

const GDACS_SEVERITY: Record<string, string>  = { red: "critical", orange: "high", yellow: "medium", green: "low" };
const GDACS_CONFIDENCE: Record<string, number> = { red: 0.85, orange: 0.70, yellow: 0.55, green: 0.40 };
const GDACS_TYPE: Record<string, string> = {
  eq: "earthquake", tc: "hurricane", fl: "flood",
  dr: "famine", vo: "climate", wf: "wildfire", ce: "conflict",
};
const MIN_CONFIDENCE = 0.40; // GDACS green-level threshold; events below this are noise

async function fetchGDACS(): Promise<OracleEventRow[]> {
  try {
    const res = await fetch("https://www.gdacs.org/xml/rss.xml");
    if (!res.ok) return [];
    const text = await res.text();
    const items: OracleEventRow[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(text)) !== null) {
      const block = m[1];
      const get = (tag: string) => block.match(new RegExp(`<[^:]*:?${tag}[^>]*>([^<]*)<`))?.[1]?.trim() ?? "";
      const alertLevel = get("alertlevel").toLowerCase();
      const eventType  = get("eventtype").toLowerCase();
      const lat = parseFloat(get("lat") || "0");
      const lng = parseFloat(get("long") || "0");
      const eventId = get("eventid") || String(Math.random());
      const delta = 2.0;
      items.push({
        id: `gdacs-${eventId}`,
        event_type: GDACS_TYPE[eventType] ?? "climate",
        region: get("title") || "Unknown region",
        status: "active" as const,
        severity: GDACS_SEVERITY[alertLevel] ?? "low",
        confidence: GDACS_CONFIDENCE[alertLevel] ?? 0.40,
        fundraising_target_usd: 0,
        raised_eth: 0,
        bbox: [lng - delta, lat - delta, lng + delta, lat + delta] as [number, number, number, number],
        oracle_sources: ["GDACS"],
        created_at: (() => { const d = new Date(get("pubDate") || 0); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); })(),
        predicted: true as const,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function oracleEventRoutes(app: FastifyInstance) {
  app.get("/oracle-events", async (_req, reply) => {
    try {
      const [usgsEvents, gdacsEvents] = await Promise.all([fetchUSGS(), fetchGDACS()]);
      const data = [...usgsEvents, ...gdacsEvents]
        .filter(e => e.confidence >= MIN_CONFIDENCE);
      // TODO: deduplicate against existing campaigns requires adding an oracle_id
      // column to the campaigns table — skipped for this iteration.
      return reply.send({ data });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch oracle events" });
    }
  });
}
