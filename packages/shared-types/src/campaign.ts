export type CampaignStatus =
  | "active"
  | "triggered"
  | "voting"
  | "funded"
  | "refundable"
  | "expired";

export type CampaignType =
  | "earthquake"
  | "hurricane"
  | "flood"
  | "wildfire"
  | "famine"
  | "conflict"
  | "disease"
  | "climate";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Campaign {
  id: string;
  onchainProposalId?: string;
  type: CampaignType;
  regionName: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  centroid: { lat: number; lng: number };
  status: CampaignStatus;
  confidence: number;
  severity: Severity;
  fundraisingTargetUsd: number;
  totalRaisedUsd: number;
  campaignDeadline: string; // ISO
  refundDeadline?: string;
  contractAddress?: string;
  ipfsMetadataCid?: string;
  institutionId?: string;
  oracleSources: string[];
  createdAt: string;
  fundedAt?: string;
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  walletAddress: string;
  registrationNumber: string;
  accreditationBody: string;
  country: string;
  verified: boolean;
  ipfsCredentialsCid?: string;
  totalReceivedUsd: number;
}
