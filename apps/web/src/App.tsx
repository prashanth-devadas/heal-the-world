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
  const [showConflicts, setShowConflicts]               = useState(true);
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
