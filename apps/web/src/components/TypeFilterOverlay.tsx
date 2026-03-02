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
      bottom: 44,
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
    <label
      onClick={() => onChange(!checked)}
      style={{
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
