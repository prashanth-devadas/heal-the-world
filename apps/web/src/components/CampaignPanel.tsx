import type { Campaign } from "../lib/api";
import { DonateButton } from "./DonateButton";

const SEVERITY_BADGE: Record<string, { bg: string; label: string }> = {
  critical: { bg: "#ff1a1a", label: "CRITICAL" },
  high:     { bg: "#ff8800", label: "HIGH" },
  medium:   { bg: "#ffdd00", label: "MEDIUM" },
  low:      { bg: "#00cc44", label: "LOW" },
};

const STATUS_LABEL: Record<Campaign["status"], string> = {
  active:     "Fundraising",
  triggered:  "Event Triggered",
  voting:     "DAO Voting",
  funded:     "Funded",
  refundable: "Refundable",
  expired:    "Expired",
};

interface CampaignPanelProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export function CampaignPanel({ campaign, onClose }: CampaignPanelProps) {
  if (!campaign) return null;

  const badge = SEVERITY_BADGE[campaign.severity] ?? { bg: "#888", label: campaign.severity.toUpperCase() };
  const raised = (campaign.raised_eth ?? 0).toFixed(4);
  const target = (campaign.fundraising_target_usd / 1000).toFixed(0);
  const confidence = Math.round(campaign.confidence * 100);

  return (
    <aside style={{
      position: "fixed",
      top: 56, right: 0,
      width: 340,
      height: "calc(100vh - 56px)",
      background: "rgba(10, 10, 20, 0.92)",
      backdropFilter: "blur(16px)",
      borderLeft: "1px solid rgba(255,255,255,0.08)",
      padding: 20,
      overflowY: "auto",
      zIndex: 90,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span style={{
              background: badge.bg,
              color: "#000",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              {badge.label}
            </span>
            <span style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              background: "rgba(255,255,255,0.07)",
              padding: "2px 6px",
              borderRadius: 4,
            }}>
              {STATUS_LABEL[campaign.status]}
            </span>
          </div>
          <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>
            {campaign.region}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 2 }}>
            {campaign.event_type.charAt(0).toUpperCase() + campaign.event_type.slice(1)}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}>
        <StatCard label="AI Confidence" value={`${confidence}%`} />
        <StatCard label="Target" value={`$${target}k`} />
        <StatCard label="Raised" value={`${raised} ETH`} />
        <StatCard label="Sources" value={campaign.oracle_sources.join(", ")} small />
      </div>

      {/* Donate */}
      {campaign.status === "active" && (
        <section>
          <h3 style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Donate
          </h3>
          <DonateButton campaign={campaign} />
        </section>
      )}

      {/* Refund notice */}
      {campaign.status === "refundable" && (
        <div style={{
          background: "rgba(250, 204, 21, 0.1)",
          border: "1px solid rgba(250, 204, 21, 0.3)",
          borderRadius: 8,
          padding: 12,
          color: "#fde047",
          fontSize: 13,
        }}>
          This campaign is in refund mode. Connect your wallet to claim your full donation back.
        </div>
      )}

      <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: "auto" }}>
        ID: {campaign.id.slice(0, 8)}…
      </p>
    </aside>
  );
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      padding: "10px 12px",
    }}>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ color: "#fff", fontSize: small ? 12 : 18, fontWeight: small ? 400 : 600 }}>
        {value}
      </p>
    </div>
  );
}
