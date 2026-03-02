const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

export interface Campaign {
  id: string;
  event_type: string;
  region: string;
  status: "active" | "triggered" | "voting" | "funded" | "refundable" | "expired";
  confidence: number;
  severity: string;
  fundraising_target_usd: number;
  raised_eth: number;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  oracle_sources: string[];
  created_at: string;
  predicted?: boolean; // true for oracle watch-list events (anticipated mode)
}

export async function fetchCampaigns(params?: { status?: string; type?: string }): Promise<Campaign[]> {
  const url = new URL(`${BASE}/campaigns`, window.location.origin);
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.type) url.searchParams.set("type", params.type);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  const res = await fetch(`${BASE}/campaigns/${id}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchOracleEvents(): Promise<Campaign[]> {
  const url = new URL(`${BASE}/oracle-events`, window.location.origin);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}
