import { useCallback, useState } from "react";
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
  const [showConflicts, setShowConflicts]               = useState(true);
  const [showNaturalDisasters, setShowNaturalDisasters] = useState(true);
  const [cesiumCanvas, setCesiumCanvas] = useState<HTMLCanvasElement | null>(null);
  const heatmapEnabled  = useFeatureFlag("risk_heatmap");

  const { data: ongoingCampaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchCampaigns({ status: "active" }),
    refetchInterval: 60_000,
  });

  // Oracle events are always fetched — they ARE the live calamity layer on the globe.
  // In "anticipated" mode they are the primary source; in "ongoing" mode they
  // supplement (potentially empty) DB campaigns so the map is never blank.
  const { data: oracleEvents = [] } = useQuery({
    queryKey: ["oracle-events"],
    queryFn: fetchOracleEvents,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  // In "ongoing" mode: show active DB campaigns merged with live oracle events.
  // In "anticipated" mode: show only the oracle watch-list.
  const rawCampaigns: Campaign[] =
    trackingMode === "ongoing"
      ? mergeById(ongoingCampaigns, oracleEvents)
      : oracleEvents;

  const visibleCampaigns = rawCampaigns.filter(c => {
    const isConflict = c.event_type === "conflict";
    if (isConflict  && !showConflicts)        return false;
    if (!isConflict && !showNaturalDisasters) return false;
    return true;
  });

  const handleSelect = useCallback((campaign: Campaign) => {
    setSelected(campaign);
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    setCesiumCanvas(canvas);
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
        <Globe campaigns={visibleCampaigns} onSelect={handleSelect} onCanvasReady={handleCanvasReady} />
        {heatmapEnabled && (
          <RiskHeatmap campaigns={visibleCampaigns} cesiumCanvas={cesiumCanvas} />
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

/** Merge two campaign arrays by id, preferring the first (DB) over the second (oracle). */
function mergeById(primary: Campaign[], secondary: Campaign[]): Campaign[] {
  const seen = new Set(primary.map(c => c.id));
  return [...primary, ...secondary.filter(c => !seen.has(c.id))];
}
