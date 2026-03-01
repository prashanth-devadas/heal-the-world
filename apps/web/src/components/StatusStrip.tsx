import { useEffect, useRef, useState } from "react";
import type { Campaign } from "../lib/api";

interface StatusStripProps {
  campaigns: Campaign[];
}

export function StatusStrip({ campaigns }: StatusStripProps) {
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
    );
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");
    return () => ws.close();
  }, []);

  const critical = campaigns.filter((c) => c.severity === "critical").length;
  const active = campaigns.filter((c) => c.status === "active").length;

  const dotColor = wsStatus === "connected" ? "#4ade80" : wsStatus === "connecting" ? "#fbbf24" : "#f87171";

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 32,
      background: "rgba(10, 10, 20, 0.85)",
      backdropFilter: "blur(8px)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: 20,
      zIndex: 100,
      fontSize: 11,
      color: "rgba(255,255,255,0.5)",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
        {wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Connecting…" : "Offline"}
      </span>
      <span>{active} active campaign{active !== 1 ? "s" : ""}</span>
      {critical > 0 && (
        <span style={{ color: "#ff1a1a", fontWeight: 600 }}>
          ⚠ {critical} critical
        </span>
      )}
      <span style={{ marginLeft: "auto" }}>
        Data: USGS · GDACS · NOAA · WHO
      </span>
    </div>
  );
}
