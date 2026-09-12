import type {
  CertificateAnalyzeResponse,
  CertificateIssueRequest,
  CertificateIssueResponse,
  CertificateListItem,
  CertificateRetireResponse,
  CertificateTransferResponse,
  OnChainCertificate,
} from "@/lib/types";
import { ApiError } from "@/lib/api-error";

const MOCK_BACKEND_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";

const REASON_BANK = {
  low: ["Claimed generation is well within the plant's rated capacity for the reporting window."],
  medium: ["Claimed generation is close to the plant's capacity limit for the reporting window."],
  high: [
    "Claimed generation exceeds the plant's theoretical max output for the reporting window",
    "Generation timestamp falls outside plausible daylight hours for a solar asset at this location",
  ],
};

function delay(ms = 550) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreRecord(plant: CertificateIssueRequest["plant"], generation: CertificateIssueRequest["generation"]) {
  const hours = Math.max(
    (new Date(generation.end).getTime() - new Date(generation.start).getTime()) / 3_600_000,
    1e-6,
  );
  const theoreticalMax = plant.capacity_mw * hours;
  const ratio = theoreticalMax > 0 ? generation.mwh_claimed / theoreticalMax : Infinity;

  if (ratio > 1) {
    const score = Math.min(50 + 50 * Math.min(ratio - 1, 1), 99);
    return { score: Math.round(score), reasons: REASON_BANK.high };
  }
  if (ratio > 0.85) {
    return { score: 25, reasons: REASON_BANK.medium };
  }
  return { score: Math.round(5 + 10 * ratio), reasons: REASON_BANK.low };
}

function explanationFor(score: number, reasons: string[], plantId: string) {
  if (score < 25) {
    return `Certificate for ${plantId} shows no significant fraud indicators; the generation claim is consistent with the plant's profile.`;
  }
  if (score < 50) {
    return `Certificate for ${plantId} shows a mild anomaly: ${reasons[0]?.toLowerCase()}. Not enough on its own to flag, but worth a second look.`;
  }
  return `Certificate for ${plantId} was flagged high-risk: ${reasons.join("; ")}. Recommend manual review before relying on this certificate.`;
}

function recordKey(plantId: string, energyMwh: number, generationTimestamp: number) {
  return `${plantId}::${energyMwh}::${generationTimestamp}`;
}

type Store = {
  certs: Map<number, OnChainCertificate>;
  usedRecords: Set<string>;
  nextId: number;
};

function getStore(): Store {
  const g = globalThis as typeof globalThis & { __reconMockStore?: Store };
  if (!g.__reconMockStore) {
    g.__reconMockStore = { certs: new Map(), usedRecords: new Set(), nextId: 0 };
    seed(g.__reconMockStore);
  }
  return g.__reconMockStore;
}

function seed(store: Store) {
  const seeds: Array<[string, number, string, string, number]> = [
    ["SUNFIELD-04", 118, "solar", "2026-08-20T09:00:00Z", 8],
    ["WINDRIDGE-11", 340, "wind", "2026-08-21T14:00:00Z", 14],
    ["SUNFIELD-04", 96, "solar", "2026-08-22T09:00:00Z", 6],
    ["HYDRO-CASCADE-2", 610, "hydro", "2026-08-23T02:00:00Z", 71],
    ["WINDRIDGE-11", 500, "wind", "2026-08-24T05:00:00Z", 62],
  ];

  seeds.forEach(([plantId, mwh, , timestamp, score], i) => {
    const generationTimestamp = Math.floor(new Date(timestamp).getTime() / 1000);
    const tokenId = store.nextId++;
    const reasons = score >= 50 ? REASON_BANK.high : score >= 25 ? REASON_BANK.medium : REASON_BANK.low;
    store.certs.set(tokenId, {
      token_id: tokenId,
      owner_address: MOCK_BACKEND_ADDRESS,
      plant_id: plantId,
      energy_mwh: mwh,
      generation_timestamp: timestamp,
      fraud_score: score,
      retired_on_chain: i === 3,
      risk_reasons: score >= 25 ? reasons : [],
      explanation: explanationFor(score, reasons, plantId),
      raw_record: {
        to_address: MOCK_BACKEND_ADDRESS,
        plant: { id: plantId, type: "solar", capacity_mw: 50, lat: 23.03, lon: 72.58 },
        generation: { mwh_claimed: mwh, start: timestamp, end: timestamp },
        issuer_id: "ISSUER-DEMO",
      },
      mint_tx_hash: `0x${(tokenId + 1).toString(16).padStart(64, "a1")}`,
      status: i === 3 ? "retired" : "issued",
      retire_tx_hash: i === 3 ? `0x${"b2".repeat(32)}` : null,
      created_at: timestamp,
    });
    store.usedRecords.add(recordKey(plantId, mwh, generationTimestamp));
  });
}

export const mockApi = {
  async analyzeCertificate(payload: CertificateIssueRequest): Promise<CertificateAnalyzeResponse> {
    await delay(900);
    const { score, reasons } = scoreRecord(payload.plant, payload.generation);
    return { fraud_score: score, risk_reasons: reasons, explanation: explanationFor(score, reasons, payload.plant.id) };
  },

  async issueCertificate(payload: CertificateIssueRequest): Promise<CertificateIssueResponse> {
    await delay(1100);
    const store = getStore();
    const generationTimestamp = Math.floor(new Date(payload.generation.end).getTime() / 1000);
    const energyMwh = Math.round(payload.generation.mwh_claimed);
    const key = recordKey(payload.plant.id, energyMwh, generationTimestamp);

    if (store.usedRecords.has(key)) {
      throw new ApiError(409, "This generation record has already been certified.");
    }

    const { score, reasons } = scoreRecord(payload.plant, payload.generation);
    const toAddress = payload.to_address ?? MOCK_BACKEND_ADDRESS;
    const tokenId = store.nextId++;
    const txHash = `0x${tokenId.toString(16).padStart(4, "0")}${"c3".repeat(30)}`;

    store.usedRecords.add(key);
    store.certs.set(tokenId, {
      token_id: tokenId,
      owner_address: toAddress,
      plant_id: payload.plant.id,
      energy_mwh: energyMwh,
      generation_timestamp: payload.generation.end,
      fraud_score: score,
      retired_on_chain: false,
      risk_reasons: reasons,
      explanation: explanationFor(score, reasons, payload.plant.id),
      raw_record: { to_address: toAddress, plant: payload.plant, generation: payload.generation, issuer_id: payload.issuer_id },
      mint_tx_hash: txHash,
      status: "issued",
      retire_tx_hash: null,
      created_at: new Date().toISOString(),
    });

    return {
      token_id: tokenId,
      tx_hash: txHash,
      owner_address: toAddress,
      plant_id: payload.plant.id,
      energy_mwh: energyMwh,
      generation_timestamp: payload.generation.end,
      fraud_score: score,
      risk_reasons: reasons,
      explanation: explanationFor(score, reasons, payload.plant.id),
      status: "issued",
    };
  },

  async listCertificates(): Promise<CertificateListItem[]> {
    await delay(400);
    return [...getStore().certs.values()]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((c) => ({
        token_id: c.token_id,
        owner_address: c.owner_address,
        plant_id: c.plant_id,
        energy_mwh: c.energy_mwh,
        generation_timestamp: c.generation_timestamp,
        fraud_score: c.fraud_score,
        status: c.status,
        mint_tx_hash: c.mint_tx_hash,
        created_at: c.created_at,
      }));
  },

  async getCertificate(tokenId: number): Promise<OnChainCertificate> {
    await delay(400);
    const cert = getStore().certs.get(tokenId);
    if (!cert) throw new ApiError(404, `Certificate ${tokenId} not found`);
    return cert;
  },

  async retireCertificate(tokenId: number): Promise<CertificateRetireResponse> {
    await delay(900);
    const cert = getStore().certs.get(tokenId);
    if (!cert) throw new ApiError(404, `Certificate ${tokenId} not found`);
    if (cert.owner_address.toLowerCase() !== MOCK_BACKEND_ADDRESS.toLowerCase()) {
      throw new ApiError(403, "Backend wallet is not the owner of this certificate; retirement must be signed by the owner's wallet.");
    }
    cert.status = "retired";
    cert.retired_on_chain = true;
    cert.retire_tx_hash = `0x${"d4".repeat(32)}`;
    return { token_id: tokenId, tx_hash: cert.retire_tx_hash, status: "retired" };
  },

  async transferCertificate(tokenId: number, toAddress: string): Promise<CertificateTransferResponse> {
    await delay(900);
    const cert = getStore().certs.get(tokenId);
    if (!cert) throw new ApiError(404, `Certificate ${tokenId} not found`);
    // Mirrors the contract's own rule: a retired REC has been consumed against
    // a claim, so letting it move again would let the same MWh be resold.
    if (cert.retired_on_chain) {
      throw new ApiError(409, `Certificate ${tokenId} is retired and can no longer be transferred.`);
    }
    if (cert.owner_address.toLowerCase() !== MOCK_BACKEND_ADDRESS.toLowerCase()) {
      throw new ApiError(403, "Backend wallet is not the owner of this certificate; the transfer must be signed by the owner's wallet.");
    }
    cert.owner_address = toAddress;
    return {
      token_id: tokenId,
      tx_hash: `0x${"e5".repeat(32)}`,
      owner_address: toAddress,
      status: cert.status,
    };
  },
};
