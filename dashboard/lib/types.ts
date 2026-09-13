// Mirrors backend/app/schemas.py — the on-chain certificate contract.
// Keep in sync by hand; there is no shared codegen between the two repos yet.

export type Plant = {
  id: string;
  type: string; // "solar" | "wind" | "hydro" | ...
  capacity_mw: number;
  lat: number;
  lon: number;
};

export type Generation = {
  mwh_claimed: number;
  start: string; // ISO datetime
  end: string; // ISO datetime
};

export type CertificateIssueRequest = {
  to_address?: string;
  plant: Plant;
  generation: Generation;
  issuer_id: string;
};

export type CertificateAnalyzeResponse = {
  fraud_score: number; // 0-100
  risk_reasons: string[];
  explanation: string;
};

export type CertificateIssueResponse = {
  token_id: number;
  tx_hash: string;
  owner_address: string;
  plant_id: string;
  energy_mwh: number;
  generation_timestamp: string;
  fraud_score: number; // 0-100
  risk_reasons: string[];
  explanation: string;
  status: "issued" | "retired";
};

export type OnChainCertificate = {
  token_id: number;
  owner_address: string;
  plant_id: string;
  energy_mwh: number;
  generation_timestamp: string;
  fraud_score: number;
  retired_on_chain: boolean;
  risk_reasons: string[];
  explanation: string;
  raw_record: {
    to_address: string;
    plant: Plant;
    generation: Generation;
    issuer_id: string;
  };
  mint_tx_hash: string;
  status: "issued" | "retired";
  retire_tx_hash: string | null;
  created_at: string;
};

export type CertificateListItem = {
  token_id: number;
  owner_address: string;
  plant_id: string;
  energy_mwh: number;
  generation_timestamp: string;
  fraud_score: number;
  status: "issued" | "retired";
  mint_tx_hash: string;
  created_at: string;
};

export type CertificateTransferRequest = {
  to_address: string;
};

export type CertificateTransferResponse = {
  token_id: number;
  tx_hash: string;
  owner_address: string;
  status: "issued" | "retired";
};

export type CertificateRetireResponse = {
  token_id: number;
  tx_hash: string;
  status: "issued" | "retired";
};

/** GET / on the backend — which analysis sources are live and whether minting can work. */
export type SystemStatus = {
  service: string;
  sources: Record<string, "real" | "mock">;
  chain: {
    connected: boolean;
    contract_address: string | null;
    issuer_wallet: string | null;
    ready: boolean;
  };
};

export type ApiErrorBody = {
  detail: string;
};

/** Fraud-flagged threshold, out of 100 — matches the backend's 0.5 (of 1.0) cutoff. */
export const FRAUD_FLAG_THRESHOLD = 50;

export function riskLevel(score: number): "low" | "medium" | "high" {
  if (score >= FRAUD_FLAG_THRESHOLD) return "high";
  if (score >= 25) return "medium";
  return "low";
}
