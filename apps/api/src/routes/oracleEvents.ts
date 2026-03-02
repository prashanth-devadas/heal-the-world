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

// ACLED event-type mapping (event_type field in API response)
const ACLED_TYPE_MAP: Record<string, string> = {
  "Battles": "conflict",
  "Violence against civilians": "conflict",
  "Explosions/Remote violence": "conflict",
  "Protests": "conflict",
  "Riots": "conflict",
  "Strategic developments": "conflict",
};

// ACLED fatalities → severity
function acledSeverity(fatalities: number): string {
  if (fatalities >= 100) return "critical";
  if (fatalities >= 20)  return "high";
  if (fatalities >= 5)   return "medium";
  return "low";
}

// In-process token cache — ACLED access tokens are valid for 24 hours.
let acledTokenCache: { value: string; expiresAt: number } | null = null;

/**
 * Obtain a Bearer token from the ACLED OAuth endpoint.
 * Caches the token in memory and reuses it until 60 s before expiry.
 */
async function getACLEDToken(): Promise<string | null> {
  // Return cached token if still valid (with 60 s buffer)
  if (acledTokenCache && acledTokenCache.expiresAt > Date.now() + 60_000) {
    return acledTokenCache.value;
  }

  const username = process.env.ACLED_USERNAME;
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) return null;

  try {
    const res = await fetch("https://acleddata.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username,
        password,
        grant_type: "password",
        client_id: "acled",
      }),
    });
    if (!res.ok) return null;

    const json = await res.json() as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;

    acledTokenCache = {
      value: json.access_token,
      // expires_in is in seconds; default 86400 (24 h) per ACLED docs
      expiresAt: Date.now() + (json.expires_in ?? 86400) * 1000,
    };
    return acledTokenCache.value;
  } catch {
    return null;
  }
}

async function fetchACLED(): Promise<OracleEventRow[]> {
  const token = await getACLEDToken();
  if (!token) return [];

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD
    const today = new Date().toISOString().slice(0, 10);

    const params = new URLSearchParams({
      event_date:       since,
      event_date_where: "BETWEEN",
      event_date_to:    today,
      limit:            "500",
      fields:           "event_id_cnty:event_date:event_type:country:location:latitude:longitude:fatalities:source",
    });

    const res = await fetch(
      `https://acleddata.com/api/acled/read?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];

    const json = await res.json() as { data?: any[] };
    return (json.data ?? [])
      .filter((e: any) => e.event_type in ACLED_TYPE_MAP)
      .map((e: any) => {
        const lat        = parseFloat(e.latitude  ?? "0");
        const lng        = parseFloat(e.longitude ?? "0");
        const fatalities = Number(e.fatalities ?? 0);
        const delta      = 0.5;
        return {
          id:                    `acled-${e.event_id_cnty}`,
          event_type:            ACLED_TYPE_MAP[e.event_type] ?? "conflict",
          region:                `${e.location ?? "Unknown"}, ${e.country ?? ""}`.trim().replace(/,$/, ""),
          status:                "active" as const,
          severity:              acledSeverity(fatalities),
          confidence:            0.90, // ACLED is curated, high confidence
          fundraising_target_usd: 0,
          raised_eth:            0,
          bbox:                  [lng - delta, lat - delta, lng + delta, lat + delta] as [number, number, number, number],
          oracle_sources:        ["ACLED"],
          created_at:            new Date(e.event_date ?? Date.now()).toISOString(),
          predicted:             true as const,
        };
      });
  } catch {
    return [];
  }
}

export async function oracleEventRoutes(app: FastifyInstance) {
  app.get("/oracle-events", async (_req, reply) => {
    try {
      const [usgsEvents, gdacsEvents, acledEvents] = await Promise.all([
        fetchUSGS(),
        fetchGDACS(),
        fetchACLED(),
      ]);
      const data = [...usgsEvents, ...gdacsEvents, ...acledEvents]
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
