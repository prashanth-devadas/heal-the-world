import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCampaigns, type Campaign } from "./lib/api";
import { Globe } from "./components/Globe";
import { TopBar } from "./components/TopBar";
import { CampaignPanel } from "./components/CampaignPanel";
import { StatusStrip } from "./components/StatusStrip";
import { RiskHeatmap } from "./components/RiskHeatmap";
import { useFeatureFlag } from "./hooks/useFeatureFlag";

export function App() {
  const [selected, setSelected] = useState<Campaign | null>(null);
  const cesiumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapEnabled = useFeatureFlag("risk_heatmap");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchCampaigns({ status: "active" }),
    refetchInterval: 60_000,
  });

  const handleSelect = useCallback((campaign: Campaign) => {
    setSelected(campaign);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <TopBar />

      <div style={{ position: "absolute", inset: 0, top: 56, bottom: 32 }}>
        <Globe campaigns={campaigns} onSelect={handleSelect} />
        {heatmapEnabled && (
          <RiskHeatmap campaigns={campaigns} cesiumCanvas={cesiumCanvasRef.current} />
        )}
      </div>

      <CampaignPanel campaign={selected} onClose={() => setSelected(null)} />
      <StatusStrip campaigns={campaigns} />
    </div>
  );
}
