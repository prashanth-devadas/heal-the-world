export interface PredictionEvent {
  type: string;
  region: string;
  bbox: [number, number, number, number];
  confidence: number;
  severity: string;
  estimatedAffectedPopulation: number;
  fundraisingTargetUsd: number;
  oracleSources: string[];
  campaignDeadlineDays: number;
  predictionWindow: { start: string; end: string };
  oracleConfirmed: boolean;
}

export interface OracleRawEvent {
  source: string;
  eventType: string;
  rawData: Record<string, unknown>;
  location: { lat: number; lng: number };
  confidence: number;
  ingestedAt: string;
}
