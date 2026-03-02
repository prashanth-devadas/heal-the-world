import { describe, it, expect, vi, beforeEach } from "vitest";
import { build } from "../test-helpers";

const USGS_RESPONSE = {
  features: [
    {
      id: "us7000test",
      properties: { mag: 6.8, place: "50km NE of Testville", sig: 750, time: 1700000000000 },
      geometry: { coordinates: [120.5, 35.2, 10.0] },
    },
  ],
};

const GDACS_RESPONSE = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Flood in Bangladesh</title>
    <gdacs:alertlevel>Orange</gdacs:alertlevel>
    <gdacs:eventtype>FL</gdacs:eventtype>
    <gdacs:eventid>1001</gdacs:eventid>
    <geo:lat>23.6</geo:lat>
    <geo:long>90.3</geo:long>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("usgs.gov")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(USGS_RESPONSE) });
    }
    if (url.includes("gdacs.org")) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(GDACS_RESPONSE) });
    }
    return Promise.resolve({ ok: false });
  }));
});

describe("GET /api/v1/oracle-events", () => {
  it("returns 200 with data array", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/oracle-events" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns events with required fields", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/oracle-events" });
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThan(0);
    const event = body.data[0];
    expect(event).toHaveProperty("id");
    expect(event).toHaveProperty("event_type");
    expect(event).toHaveProperty("region");
    expect(event).toHaveProperty("severity");
    expect(event).toHaveProperty("confidence");
    expect(event).toHaveProperty("bbox");
    expect(event).toHaveProperty("predicted", true);
    expect(Array.isArray(event.bbox)).toBe(true);
    expect(event.bbox).toHaveLength(4);
  });

  it("returns events from both USGS and GDACS", async () => {
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/oracle-events" });
    const body = JSON.parse(res.body);
    const sources = body.data.flatMap((e: any) => e.oracle_sources);
    expect(sources).toContain("USGS");
    expect(sources).toContain("GDACS");
  });

  it("returns 200 with empty array when external feeds fail", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false })));
    const app = await build();
    const res = await app.inject({ method: "GET", url: "/api/v1/oracle-events" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
  });
});
