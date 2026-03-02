# Burger Menu + Tracking Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a burger-menu drawer with Ongoing/Anticipated tracking modes and always-visible Conflicts/Natural Disasters type-filter checkboxes, with impact-sized colored bubble markers on the globe.

**Architecture:** App.tsx owns `trackingMode` + `showConflicts` + `showNaturalDisasters` state and passes filtered campaigns to Globe. A new API route `/api/v1/oracle-events` live-polls USGS + GDACS for the "anticipated" data. Globe renders bubbles sized by severity, colored by category (red = conflict, amber = natural disaster), outlined when predicted.

**Tech Stack:** TypeScript, React, Fastify, CesiumJS, Vitest

---

## File Map

| File | Action |
|------|--------|
| `apps/api/src/routes/oracleEvents.ts` | CREATE |
| `apps/api/src/routes/oracleEvents.test.ts` | CREATE |
| `apps/api/src/test-helpers.ts` | MODIFY — register oracle route |
| `apps/api/src/index.ts` | MODIFY — register oracle route |
| `apps/web/src/lib/api.ts` | MODIFY — add OracleEvent type + fetchOracleEvents |
| `apps/web/src/components/Globe.tsx` | MODIFY — new bubble renderer |
| `apps/web/src/components/TypeFilterOverlay.tsx` | CREATE |
| `apps/web/src/components/Drawer.tsx` | CREATE |
| `apps/web/src/components/TopBar.tsx` | MODIFY — add burger button |
| `apps/web/src/App.tsx` | MODIFY — state, filtering, wire components |

---

## Task 1: Backend — oracle events route

**Files:**
- Create: `apps/api/src/routes/oracleEvents.ts`
- Create: `apps/api/src/routes/oracleEvents.test.ts`

### Step 1: Write the failing test

Create `apps/api/src/routes/oracleEvents.test.ts`:

```typescript
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

vi.mock("../db/client", () => ({
  db: { from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })) },
}));

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
```

### Step 2: Run test — verify it fails

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/api test 2>&1 | grep -A 5 "oracle"
```

Expected: test file not found or import error (route doesn't exist yet).

### Step 3: Create the route

Create `apps/api/src/routes/oracleEvents.ts`:

```typescript
import { FastifyInstance } from "fastify";
import { db } from "../db/client";

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
  dr: "famine", vo: "wildfire", wf: "wildfire", ce: "conflict",
};

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
        created_at: new Date(get("pubDate") || Date.now()).toISOString(),
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
      const { data: campaigns } = await db.from("campaigns").select("id");
      const existingIds = new Set((campaigns ?? []).map((c: any) => c.id));

      const [usgsEvents, gdacsEvents] = await Promise.all([fetchUSGS(), fetchGDACS()]);
      const data = [...usgsEvents, ...gdacsEvents]
        .filter(e => e.confidence >= 0.40)
        .filter(e => !existingIds.has(e.id));

      return reply.send({ data });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch oracle events" });
    }
  });
}
```

### Step 4: Update test-helpers to include oracle route

Edit `apps/api/src/test-helpers.ts` — add import and registration:

```typescript
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
```

### Step 5: Run all API tests — verify they pass

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/api test 2>&1
```

Expected output: `8 passed` (4 existing + 4 new oracle tests).

### Step 6: Register route in production server

Edit `apps/api/src/index.ts` — add two lines (import + register):

```typescript
// After existing imports:
import { oracleEventRoutes } from "./routes/oracleEvents";

// After existing app.register(wsRoutes...) line:
app.register(oracleEventRoutes, { prefix: "/api/v1" });
```

### Step 7: Verify API still builds

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/api build 2>&1
```

Expected: no TypeScript errors.

### Step 8: Commit

```bash
cd /tmp/crisisvault
git add apps/api/src/routes/oracleEvents.ts \
        apps/api/src/routes/oracleEvents.test.ts \
        apps/api/src/test-helpers.ts \
        apps/api/src/index.ts
git commit -m "feat(api): add oracle-events route for anticipated issues"
```

---

## Task 2: Frontend — extend Campaign type + add fetchOracleEvents

**Files:**
- Modify: `apps/web/src/lib/api.ts`

### Step 1: Update the file

Replace the contents of `apps/web/src/lib/api.ts` with:

```typescript
const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export interface Campaign {
  id: string;
  event_type: string;
  region: string;
  status: "active" | "triggered" | "voting" | "funded" | "refundable" | "expired";
  confidence: number;
  severity: string;
  fundraising_target_usd: number;
  raised_eth: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  oracle_sources: string[];
  created_at: string;
  predicted?: boolean; // true for oracle watch-list events (anticipated mode)
}

export async function fetchCampaigns(params?: { status?: string; type?: string }): Promise<Campaign[]> {
  const url = new URL(`${BASE}/campaigns`, window.location.origin);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.type) url.searchParams.set("type", params.type);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  const res = await fetch(`${BASE}/campaigns/${id}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchOracleEvents(): Promise<Campaign[]> {
  const url = new URL(`${BASE}/oracle-events`, window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: no errors.

### Step 3: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add predicted flag to Campaign type and fetchOracleEvents"
```

---

## Task 3: Frontend — update Globe bubble markers

**Files:**
- Modify: `apps/web/src/components/Globe.tsx`

The current Globe uses `makeMarkerSvg(color, severity)` with fixed sizes and a single color palette. Replace it with a new version that:
- Sizes by severity (critical=28, high=20, medium=14, low=9)
- Colors by category: conflicts = red family, natural disasters = amber family
- Renders outlined/dashed SVG when `campaign.predicted === true`

### Step 1: Replace Globe.tsx

```typescript
import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Campaign } from "../lib/api";

const BUBBLE_SIZES: Record<string, number> = {
  critical: 28, high: 20, medium: 14, low: 9,
};

// Conflicts: red tones; Natural disasters: amber/orange tones
const CONFLICT_COLORS: Record<string, string> = {
  critical: "#ff1a1a", high: "#ff5555", medium: "#ff8888", low: "#ffaaaa",
};
const NATURAL_COLORS: Record<string, string> = {
  critical: "#ff6600", high: "#ff9900", medium: "#ffcc00", low: "#ffee66",
};

const CONFLICT_TYPES = new Set(["conflict"]);

function getBubbleColor(campaign: Campaign): string {
  const palette = CONFLICT_TYPES.has(campaign.event_type) ? CONFLICT_COLORS : NATURAL_COLORS;
  return palette[campaign.severity] ?? "#888888";
}

function makeMarkerSvg(campaign: Campaign): string {
  const size = BUBBLE_SIZES[campaign.severity] ?? 9;
  const color = getBubbleColor(campaign);
  const predicted = campaign.predicted === true;
  const svgSize = 60; // canvas size — large enough for biggest bubble + glow
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const fill = predicted ? "none" : color;
  const stroke = color;
  const strokeWidth = predicted ? 2.5 : 1.5;
  const strokeDasharray = predicted ? "4 3" : "none";
  const glowOpacity = predicted ? 0.15 : 0.25;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">
    <circle cx="${cx}" cy="${cy}" r="${size + 6}" fill="${color}" fill-opacity="${glowOpacity}"/>
    <circle cx="${cx}" cy="${cy}" r="${size}" fill="${fill}" fill-opacity="${predicted ? 0 : 0.85}"
      stroke="${stroke}" stroke-width="${strokeWidth}"
      stroke-dasharray="${strokeDasharray}"/>
  </svg>`.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface GlobeProps {
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
}

export function Globe({ campaigns, onSelect }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // @ts-expect-error dynamic global
    window.CESIUM_BASE_URL = "/cesium";

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      creditContainer: document.createElement("div"),
    });

    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        credit: "© OpenStreetMap contributors",
      })
    );

    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.enableLighting = true;

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.entities.removeAll();

    for (const campaign of campaigns) {
      const [minLng, minLat, maxLng, maxLat] = campaign.bbox;
      const lat = (minLat + maxLat) / 2;
      const lng = (minLng + maxLng) / 2;
      const markerSize = (BUBBLE_SIZES[campaign.severity] ?? 9) * 2 + 12;

      const entity = viewer.entities.add({
        id: campaign.id,
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        billboard: {
          image: makeMarkerSvg(campaign),
          width: markerSize,
          height: markerSize,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: campaign.region,
          font: "12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -(markerSize / 2 + 4)),
          show: false,
        },
      });

      (entity as any)._campaign = campaign;
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) {
        const campaign = (picked.id as any)._campaign as Campaign | undefined;
        if (campaign) {
          picked.id.label.show = true;
          onSelect(campaign);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => { handler.destroy(); };
  }, [campaigns, onSelect]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: no errors.

### Step 3: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/components/Globe.tsx
git commit -m "feat(web): impact-sized colored bubbles, outlined for predicted events"
```

---

## Task 4: Frontend — TypeFilterOverlay component

**Files:**
- Create: `apps/web/src/components/TypeFilterOverlay.tsx`

This is a floating frosted-glass card in the bottom-left of the globe, always visible.

### Step 1: Create the component

```typescript
interface TypeFilterOverlayProps {
  showConflicts: boolean;
  showNaturalDisasters: boolean;
  onToggleConflicts: (v: boolean) => void;
  onToggleNaturalDisasters: (v: boolean) => void;
}

export function TypeFilterOverlay({
  showConflicts,
  showNaturalDisasters,
  onToggleConflicts,
  onToggleNaturalDisasters,
}: TypeFilterOverlayProps) {
  return (
    <div style={{
      position: "absolute",
      bottom: 44,   // above StatusStrip (32px) + gap
      left: 16,
      background: "rgba(10, 10, 20, 0.82)",
      backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: "10px 14px",
      zIndex: 80,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 168,
    }}>
      <CheckRow
        label="Conflicts"
        color="#ff5555"
        checked={showConflicts}
        onChange={onToggleConflicts}
      />
      <CheckRow
        label="Natural Disasters"
        color="#ff9900"
        checked={showNaturalDisasters}
        onChange={onToggleNaturalDisasters}
      />
    </div>
  );
}

function CheckRow({
  label, color, checked, onChange,
}: { label: string; color: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
      fontSize: 12,
      color: checked ? "#fff" : "rgba(255,255,255,0.4)",
      transition: "color 0.15s",
    }}>
      <span style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        border: `2px solid ${color}`,
        background: checked ? color : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.15s",
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3L3.5 5.5L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}
```

### Step 2: Verify TypeScript

```bash
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: no errors.

### Step 3: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/components/TypeFilterOverlay.tsx
git commit -m "feat(web): add TypeFilterOverlay floating checkboxes"
```

---

## Task 5: Frontend — Drawer component

**Files:**
- Create: `apps/web/src/components/Drawer.tsx`

Slides in from the left. Closes on click-outside. Contains "Tracking Data" radio group.

### Step 1: Create the component

```typescript
import { useEffect, useRef } from "react";

type TrackingMode = "ongoing" | "anticipated";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  trackingMode: TrackingMode;
  onTrackingModeChange: (mode: TrackingMode) => void;
}

export function Drawer({ open, onClose, trackingMode, onTrackingModeChange }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  return (
    <div
      ref={drawerRef}
      style={{
        position: "fixed",
        top: 56,
        left: 0,
        width: 260,
        height: "calc(100vh - 56px - 32px)",
        background: "rgba(10, 10, 20, 0.92)",
        backdropFilter: "blur(16px)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        zIndex: 95,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 0",
        overflowY: "auto",
      }}
      aria-hidden={!open}
    >
      {/* Section header */}
      <div style={{
        padding: "0 20px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
        }}>
          Tracking Data
        </span>
      </div>

      {/* Radio options */}
      <RadioOption
        label="Ongoing Issues"
        description="Current active conflicts & disasters"
        selected={trackingMode === "ongoing"}
        onClick={() => { onTrackingModeChange("ongoing"); onClose(); }}
      />
      <RadioOption
        label="Issues Anticipated"
        description="Watch-list events predicted next ~7 days"
        selected={trackingMode === "anticipated"}
        onClick={() => { onTrackingModeChange("anticipated"); onClose(); }}
      />
    </div>
  );
}

function RadioOption({
  label, description, selected, onClick,
}: { label: string; description: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "rgba(255,255,255,0.06)" : "transparent",
        border: "none",
        borderLeft: selected ? "3px solid #60a5fa" : "3px solid transparent",
        cursor: "pointer",
        padding: "10px 20px",
        textAlign: "left",
        width: "100%",
        transition: "background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `2px solid ${selected ? "#60a5fa" : "rgba(255,255,255,0.3)"}`,
          background: selected ? "#60a5fa" : "transparent",
          flexShrink: 0,
          transition: "all 0.15s",
        }} />
        <div>
          <div style={{ color: selected ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500 }}>
            {label}
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}
```

### Step 2: Verify TypeScript

```bash
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: no errors.

### Step 3: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/components/Drawer.tsx
git commit -m "feat(web): add slide-out Drawer with Tracking Data radio group"
```

---

## Task 6: Frontend — add burger button to TopBar

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`

Add `onBurgerClick` prop and `☰` button at left edge:

### Step 1: Replace TopBar.tsx

```typescript
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface TopBarProps {
  onBurgerClick: () => void;
}

export function TopBar({ onBurgerClick }: TopBarProps) {
  return (
    <header style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      height: 56,
      background: "rgba(10, 10, 20, 0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 16,
      zIndex: 100,
    }}>
      {/* Burger button */}
      <button
        onClick={onBurgerClick}
        aria-label="Open menu"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: "block",
            width: 20,
            height: 2,
            background: "rgba(255,255,255,0.75)",
            borderRadius: 1,
          }} />
        ))}
      </button>

      <span style={{ fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: -0.5 }}>
        🌐 CrisisVault
      </span>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, flex: 1 }}>
        Pre-emptive Disaster Relief
      </span>
      <ConnectButton />
    </header>
  );
}
```

### Step 2: Verify TypeScript

```bash
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: error about `App.tsx` not passing `onBurgerClick` — that's fine, we fix it next.

### Step 3: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/components/TopBar.tsx
git commit -m "feat(web): add burger button to TopBar"
```

---

## Task 7: Frontend — wire everything in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

This is the final wiring task. Adds state, filtering logic, and connects all new components.

### Step 1: Replace App.tsx

```typescript
import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaigns, fetchOracleEvents, type Campaign } from "./lib/api";
import { Globe } from "./components/Globe";
import { TopBar } from "./components/TopBar";
import { CampaignPanel } from "./components/CampaignPanel";
import { StatusStrip } from "./components/StatusStrip";
import { RiskHeatmap } from "./components/RiskHeatmap";
import { Drawer } from "./components/Drawer";
import { TypeFilterOverlay } from "./components/TypeFilterOverlay";
import { useFeatureFlag } from "./hooks/useFeatureFlag";

type TrackingMode = "ongoing" | "anticipated";

export function App() {
  const [selected, setSelected]         = useState<Campaign | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("ongoing");
  const [showConflicts, setShowConflicts]             = useState(true);
  const [showNaturalDisasters, setShowNaturalDisasters] = useState(true);
  const cesiumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapEnabled  = useFeatureFlag("risk_heatmap");

  const { data: ongoingCampaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchCampaigns({ status: "active" }),
    refetchInterval: 60_000,
  });

  const { data: anticipatedCampaigns = [] } = useQuery({
    queryKey: ["oracle-events"],
    queryFn: fetchOracleEvents,
    enabled: trackingMode === "anticipated",
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  const rawCampaigns = trackingMode === "ongoing" ? ongoingCampaigns : anticipatedCampaigns;

  const visibleCampaigns = rawCampaigns.filter(c => {
    const isConflict = c.event_type === "conflict";
    if (isConflict  && !showConflicts)        return false;
    if (!isConflict && !showNaturalDisasters) return false;
    return true;
  });

  const handleSelect = useCallback((campaign: Campaign) => {
    setSelected(campaign);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <TopBar onBurgerClick={() => setDrawerOpen(v => !v)} />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        trackingMode={trackingMode}
        onTrackingModeChange={mode => {
          setTrackingMode(mode);
          setSelected(null);
        }}
      />

      <div style={{ position: "absolute", inset: 0, top: 56, bottom: 32 }}>
        <Globe campaigns={visibleCampaigns} onSelect={handleSelect} />
        {heatmapEnabled && (
          <RiskHeatmap campaigns={visibleCampaigns} cesiumCanvas={cesiumCanvasRef.current} />
        )}
        <TypeFilterOverlay
          showConflicts={showConflicts}
          showNaturalDisasters={showNaturalDisasters}
          onToggleConflicts={setShowConflicts}
          onToggleNaturalDisasters={setShowNaturalDisasters}
        />
      </div>

      <CampaignPanel campaign={selected} onClose={() => setSelected(null)} />
      <StatusStrip campaigns={visibleCampaigns} />
    </div>
  );
}
```

### Step 2: Full TypeScript check

```bash
cd /tmp/crisisvault
export PATH="/usr/local/share/npm-global/bin:$PATH"
pnpm --filter @crisisvault/web exec tsc --noEmit 2>&1
```

Expected: no errors.

### Step 3: Run all API tests one final time

```bash
pnpm --filter @crisisvault/api test 2>&1
```

Expected: all 8 tests pass.

### Step 4: Verify Vite dev server is still healthy

```bash
curl -s http://localhost:5173/ | head -5
```

Expected: HTML response (Vite is serving).

### Step 5: Commit

```bash
cd /tmp/crisisvault
git add apps/web/src/App.tsx
git commit -m "feat(web): wire burger menu, tracking mode, and type filters in App"
```

---

## Final Smoke Test

1. Open **http://localhost:5173** in browser
2. Verify globe loads with bubble markers (sized by severity, red for conflicts, amber for natural disasters)
3. Click **☰** — drawer slides in from left with "Ongoing Issues" selected
4. Click "Issues Anticipated" — globe switches to oracle data (empty in sandbox due to firewall, globe shows clean)
5. Uncheck "Conflicts" in the overlay — conflict markers disappear
6. Uncheck "Natural Disasters" — globe shows plain map
7. Re-check both — all markers return
8. Click outside drawer — drawer closes
