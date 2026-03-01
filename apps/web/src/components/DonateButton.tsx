import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import type { Campaign } from "../lib/api";

// CampaignVault ABI — only the donate() function
const DONATE_ABI = [
  {
    name: "donate",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

interface DonateButtonProps {
  campaign: Campaign;
  vaultAddress?: `0x${string}`;
}

export function DonateButton({ campaign: _campaign, vaultAddress }: DonateButtonProps) {
  const { isConnected } = useAccount();
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const [amount, setAmount] = useState("0.01");

  if (!vaultAddress) {
    return (
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Contract address not yet available.
      </p>
    );
  }

  if (!isConnected) {
    return (
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Connect your wallet to donate.
      </p>
    );
  }

  const handleDonate = () => {
    writeContract({
      address: vaultAddress,
      abi: DONATE_ABI,
      functionName: "donate",
      value: parseEther(amount),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
          }}
        />
        <span style={{ color: "rgba(255,255,255,0.5)", alignSelf: "center", fontSize: 13 }}>ETH</span>
      </div>
      <button
        onClick={handleDonate}
        disabled={isPending}
        style={{
          padding: "10px 16px",
          background: isPending ? "rgba(99,102,241,0.4)" : "#6366f1",
          border: "none",
          borderRadius: 8,
          color: "#fff",
          fontWeight: 600,
          fontSize: 14,
          cursor: isPending ? "not-allowed" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {isPending ? "Confirming…" : `Donate ${amount} ETH`}
      </button>
      {isSuccess && (
        <p style={{ color: "#4ade80", fontSize: 12 }}>Donation confirmed!</p>
      )}
      {error && (
        <p style={{ color: "#f87171", fontSize: 12 }}>
          {(error as Error).message.slice(0, 80)}
        </p>
      )}
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.4 }}>
        100% refunded if the event is a false alarm or DAO rejects disbursement.
      </p>
    </div>
  );
}
