import type {
  CertificateAnalyzeResponse,
  CertificateIssueRequest,
  CertificateIssueResponse,
  CertificateListItem,
  CertificateRetireResponse,
  CertificateTransferResponse,
  OnChainCertificate,
  SystemStatus,
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

// Demo registry: real plant archetypes at real Indian grid coordinates, so
// the physics views (solar elevation, clear-sky envelopes) compute meaningful
// results. Claims are sized against each plant's actual physical ceiling for
// its window — clean ones sit inside it, flagged ones break it in the way
// their reasons describe.
const PLANTS = {
  "SOLAR-PLANT-17": { type: "solar", capacity_mw: 5, lat: 23.0225, lon: 72.5714, issuer: "ISS-102 · Helios Renewables" },
  "SUNFIELD-04": { type: "solar", capacity_mw: 50, lat: 26.9124, lon: 70.9001, issuer: "ISS-117 · TerraVolt Syndicate" },
  "SOLAR-ARRAY-08": { type: "solar", capacity_mw: 30, lat: 14.1006, lon: 77.2789, issuer: "ISS-117 · TerraVolt Syndicate" },
  "WINDRIDGE-11": { type: "wind", capacity_mw: 120, lat: 23.7337, lon: 69.8597, issuer: "ISS-205 · Kite Renew" },
  "WIND-FARM-BETA-4": { type: "wind", capacity_mw: 60, lat: 8.9546, lon: 77.7022, issuer: "ISS-205 · Kite Renew" },
  "HYDRO-CASCADE-2": { type: "hydro", capacity_mw: 80, lat: 31.1048, lon: 77.1734, issuer: "ISS-311 · Himadri Hydro" },
  "BIOMASS-UNIT-3": { type: "biomass", capacity_mw: 15, lat: 30.901, lon: 75.8573, issuer: "ISS-311 · Himadri Hydro" },
} as const;

type PlantKey = keyof typeof PLANTS;

const WALLETS = {
  backend: MOCK_BACKEND_ADDRESS,
  apexCarbon: "0xA5c0B91e44F2d7c3A0e9b1F6d2E8c4B7a3D19f42",
  vanguard: "0x3F8e21Cd7b9A4e6F0d1C2b3A4e5F6d7C8b9A0e31",
  kiteTrading: "0x9B2d4F6a8C0e1D3b5A7c9E1f3B5d7F9a1C3e5B77",
} as const;

const REASONS = {
  night: [
    "Generation claimed while the sun was below the horizon at the plant's coordinates (solar elevation < 0°)",
    "Claimed output exceeds modelled clear-sky irradiance for the reporting window (0 W/m² available)",
  ],
  overCapacity: [
    "Claimed generation exceeds the plant's theoretical max output for the reporting window",
    "Capacity factor above 100% of nameplate rating",
  ],
  tradingLoop: [
    "Certificates recirculated through a closed trading loop back to an affiliate of the issuer",
    "Transfer velocity well above the regional market median",
  ],
  stepCliff: [
    "Stepped generation profile inconsistent with photovoltaic ramp physics (+6.4σ from regional peers)",
    "Claimed generation exceeds the plant's theoretical max output for the reporting window",
  ],
  nearCap: ["Claimed generation is close to the plant's capacity limit for the reporting window."],
  benford: ["Leading-digit distribution of this issuer's recent claims drifts from Benford's law (p < 0.05)"],
};

type Seed = {
  plant: PlantKey;
  start: string;
  end: string;
  mwh: number;
  score: number;
  reasons: string[];
  owner?: keyof typeof WALLETS;
  retired?: boolean;
  mintedAfterHours?: number;
};

const SEEDS: Seed[] = [
  { plant: "SUNFIELD-04", start: "2026-08-29T03:30:00Z", end: "2026-08-29T07:30:00Z", mwh: 118, score: 8, reasons: [] },
  { plant: "WINDRIDGE-11", start: "2026-08-29T12:00:00Z", end: "2026-08-29T18:00:00Z", mwh: 340, score: 11, reasons: [] },
  { plant: "HYDRO-CASCADE-2", start: "2026-08-30T00:00:00Z", end: "2026-08-30T08:00:00Z", mwh: 520, score: 6, reasons: [], retired: true },
  { plant: "SOLAR-ARRAY-08", start: "2026-08-30T04:00:00Z", end: "2026-08-30T08:00:00Z", mwh: 74, score: 9, reasons: [] },
  { plant: "SUNFIELD-04", start: "2026-08-31T03:30:00Z", end: "2026-08-31T07:30:00Z", mwh: 96, score: 6, reasons: [], owner: "vanguard" },
  { plant: "WIND-FARM-BETA-4", start: "2026-08-31T09:00:00Z", end: "2026-08-31T15:00:00Z", mwh: 255, score: 14, reasons: [] },
  { plant: "BIOMASS-UNIT-3", start: "2026-09-01T00:00:00Z", end: "2026-09-01T12:00:00Z", mwh: 158, score: 31, reasons: REASONS.nearCap },
  { plant: "WINDRIDGE-11", start: "2026-09-01T14:00:00Z", end: "2026-09-01T20:00:00Z", mwh: 690, score: 38, reasons: REASONS.nearCap, owner: "kiteTrading" },
  { plant: "SOLAR-ARRAY-08", start: "2026-09-02T04:00:00Z", end: "2026-09-02T08:00:00Z", mwh: 81, score: 12, reasons: [], retired: true },
  { plant: "HYDRO-CASCADE-2", start: "2026-09-02T08:00:00Z", end: "2026-09-02T16:00:00Z", mwh: 505, score: 7, reasons: [] },
  { plant: "SUNFIELD-04", start: "2026-09-03T03:30:00Z", end: "2026-09-03T07:30:00Z", mwh: 212, score: 71, reasons: REASONS.stepCliff, owner: "apexCarbon" },
  { plant: "WIND-FARM-BETA-4", start: "2026-09-03T10:00:00Z", end: "2026-09-03T16:00:00Z", mwh: 300, score: 44, reasons: REASONS.benford },
  { plant: "BIOMASS-UNIT-3", start: "2026-09-04T00:00:00Z", end: "2026-09-04T12:00:00Z", mwh: 120, score: 10, reasons: [], retired: true },
  { plant: "WINDRIDGE-11", start: "2026-09-04T12:00:00Z", end: "2026-09-04T18:00:00Z", mwh: 910, score: 81, reasons: REASONS.overCapacity, owner: "kiteTrading" },
  { plant: "SOLAR-ARRAY-08", start: "2026-09-05T04:00:00Z", end: "2026-09-05T08:00:00Z", mwh: 69, score: 5, reasons: [] },
  { plant: "HYDRO-CASCADE-2", start: "2026-09-06T00:00:00Z", end: "2026-09-06T08:00:00Z", mwh: 480, score: 9, reasons: [], owner: "vanguard" },
  { plant: "SUNFIELD-04", start: "2026-09-06T03:30:00Z", end: "2026-09-06T07:30:00Z", mwh: 131, score: 29, reasons: REASONS.nearCap },
  { plant: "WIND-FARM-BETA-4", start: "2026-09-07T08:00:00Z", end: "2026-09-07T14:00:00Z", mwh: 240, score: 58, reasons: REASONS.tradingLoop, owner: "apexCarbon" },
  { plant: "SOLAR-PLANT-17", start: "2026-09-08T04:00:00Z", end: "2026-09-08T08:00:00Z", mwh: 13.5, score: 12, reasons: [] },
  { plant: "BIOMASS-UNIT-3", start: "2026-09-08T12:00:00Z", end: "2026-09-08T23:00:00Z", mwh: 140, score: 13, reasons: [] },
  { plant: "WINDRIDGE-11", start: "2026-09-09T12:00:00Z", end: "2026-09-09T18:00:00Z", mwh: 410, score: 16, reasons: [] },
  { plant: "SOLAR-PLANT-17", start: "2026-09-09T20:30:00Z", end: "2026-09-09T21:30:00Z", mwh: 4.2, score: 92, reasons: REASONS.night, mintedAfterHours: 1 },
  { plant: "SOLAR-ARRAY-08", start: "2026-09-10T04:00:00Z", end: "2026-09-10T08:00:00Z", mwh: 77, score: 7, reasons: [] },
  { plant: "HYDRO-CASCADE-2", start: "2026-09-11T00:00:00Z", end: "2026-09-11T08:00:00Z", mwh: 470, score: 22, reasons: [] },
  { plant: "SUNFIELD-04", start: "2026-09-11T03:30:00Z", end: "2026-09-11T07:30:00Z", mwh: 124, score: 9, reasons: [] },
  { plant: "WIND-FARM-BETA-4", start: "2026-09-12T09:00:00Z", end: "2026-09-12T15:00:00Z", mwh: 262, score: 67, reasons: REASONS.tradingLoop, owner: "vanguard" },
];

function seed(store: Store) {
  SEEDS.forEach((s) => {
    const plant = PLANTS[s.plant];
    const tokenId = store.nextId++;
    const owner = WALLETS[s.owner ?? "backend"];
    const createdAt = new Date(new Date(s.end).getTime() + (s.mintedAfterHours ?? 3) * 3_600_000).toISOString();
    const generationTimestamp = Math.floor(new Date(s.end).getTime() / 1000);

    store.certs.set(tokenId, {
      token_id: tokenId,
      owner_address: owner,
      plant_id: s.plant,
      energy_mwh: s.mwh,
      generation_timestamp: s.end,
      fraud_score: s.score,
      retired_on_chain: Boolean(s.retired),
      risk_reasons: s.reasons,
      explanation: explanationFor(s.score, s.reasons.length ? s.reasons : REASON_BANK.low, s.plant),
      raw_record: {
        to_address: owner,
        plant: { id: s.plant, type: plant.type, capacity_mw: plant.capacity_mw, lat: plant.lat, lon: plant.lon },
        generation: { mwh_claimed: s.mwh, start: s.start, end: s.end },
        issuer_id: plant.issuer,
      },
      mint_tx_hash: `0x${tokenId.toString(16).padStart(4, "0")}${"a1f3".repeat(15)}`,
      status: s.retired ? "retired" : "issued",
      retire_tx_hash: s.retired ? `0x${tokenId.toString(16).padStart(4, "0")}${"b27c".repeat(15)}` : null,
      created_at: createdAt,
    });
    store.usedRecords.add(recordKey(s.plant, Math.round(s.mwh), generationTimestamp));
  });
}

export const mockApi = {
  async getStatus(): Promise<SystemStatus> {
    await delay(200);
    return {
      service: "RECON demo data",
      sources: { ml: "mock", graph: "mock", weather: "mock", explain: "mock", ledger: "mock" },
      chain: { connected: true, contract_address: null, issuer_wallet: MOCK_BACKEND_ADDRESS, ready: true },
    };
  },

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
