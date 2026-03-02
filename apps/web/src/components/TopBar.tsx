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
      <button
        onClick={onBurgerClick}
        onMouseDown={(e) => e.stopPropagation()}
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
