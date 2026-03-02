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
