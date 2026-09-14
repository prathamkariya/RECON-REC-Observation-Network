// Derived analytics for the forensic views.
//
// Everything here is computed from certificate data the API already returns
// — nothing is invented. Where a view needs a quantity the backend doesn't
// report (irradiance, a plant's physical ceiling), it's derived from first
// principles: solar position from the plant's real coordinates and the
// claim's real timestamp, clear-sky irradiance from the Haurwitz model.
// Those derived series are labelled "modelled" in the UI, never "measured".

import { FRAUD_FLAG_THRESHOLD, type CertificateListItem, type OnChainCertificate } from "@/lib/types";

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Solar geometry (NOAA simplified solar position algorithm)

/** Solar elevation angle in degrees for a UTC instant at lat/lon. */
export function solarElevation(date: Date, lat: number, lon: number): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const trueSolarMinutes = hour * 60 + eqTime + 4 * lon;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG;
  const latR = lat * DEG;
  const cosZenith = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  return 90 - zenith / DEG;
}

/** Clear-sky global horizontal irradiance, W/m² (Haurwitz 1945). 0 below the horizon. */
export function clearSkyGhi(elevationDeg: number): number {
  if (elevationDeg <= 0) return 0;
  const cosZ = Math.cos((90 - elevationDeg) * DEG);
  return Math.max(0, 1098 * cosZ * Math.exp(-0.057 / cosZ));
}

/** Fraction of nameplate a PV array can deliver at this irradiance (performance ratio 0.82). */
const PV_PERFORMANCE_RATIO = 0.82;

function isSolar(type: string) {
  return type.toLowerCase().includes("solar") || type.toLowerCase().includes("pv");
}

// ---------------------------------------------------------------------------
// Physical validation of one certificate

export type EnvelopePoint = {
  hour: number; // 0-24, UTC
  label: string;
  ghi: number; // W/m², modelled clear-sky
  envelopeLow: number; // W/m², ±1.5σ band for cloud/aerosol variance
  envelopeHigh: number;
  physicalMaxMw: number; // what the plant could physically deliver
  claimedMw: number | null; // the certificate's claim, spread over its window
};

export type PhysicalReport = {
  plantType: string;
  capacityMw: number;
  lat: number;
  lon: number;
  windowStart: Date;
  windowEnd: Date;
  windowHours: number;
  claimedMwh: number;
  claimedMw: number;
  /** Maximum MWh the plant could produce in the claim window. */
  physicalMaxMwh: number;
  /** Modelled clear-sky MWh across the whole day (solar only). */
  dailyPotentialMwh: number;
  elevationAtClaim: number;
  ghiAtClaim: number;
  capacityFactor: number; // claimed / (capacity × hours)
  discrepancyMwh: number; // claimed − physical max (positive = impossible surplus)
  discrepancyPct: number;
  nocturnal: boolean;
  verdict: "consistent" | "marginal" | "violation";
  envelope: EnvelopePoint[];
};

export function physicalReport(cert: OnChainCertificate): PhysicalReport {
  const { plant, generation } = cert.raw_record;
  const start = new Date(generation.start);
  const end = new Date(generation.end);
  // Some records carry a single instant (start === end); treat those as a 1-hour window.
  const windowHours = Math.max((end.getTime() - start.getTime()) / 3_600_000, 1);
  const effectiveEnd = end.getTime() > start.getTime() ? end : new Date(start.getTime() + 3_600_000);
  const claimedMwh = generation.mwh_claimed;
  const claimedMw = claimedMwh / windowHours;
  const solar = isSolar(plant.type);

  const mid = new Date((start.getTime() + effectiveEnd.getTime()) / 2);
  const elevationAtClaim = solarElevation(mid, plant.lat, plant.lon);
  const ghiAtClaim = clearSkyGhi(elevationAtClaim);

  // Integrate the plant's physical ceiling across the claim window in 5-minute steps.
  let physicalMaxMwh = 0;
  const stepMs = 5 * 60_000;
  for (let t = start.getTime(); t < effectiveEnd.getTime(); t += stepMs) {
    const dtHours = Math.min(stepMs, effectiveEnd.getTime() - t) / 3_600_000;
    const mw = solar
      ? plant.capacity_mw * Math.min(1, (clearSkyGhi(solarElevation(new Date(t), plant.lat, plant.lon)) / 1000) * PV_PERFORMANCE_RATIO * 1.15)
      : plant.capacity_mw;
    physicalMaxMwh += mw * dtHours;
  }

  // 24h envelope for the claim's UTC day, 15-minute resolution.
  const dayStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const envelope: EnvelopePoint[] = [];
  let dailyPotentialMwh = 0;
  for (let i = 0; i <= 96; i++) {
    const t = new Date(dayStart + i * 15 * 60_000);
    const elev = solarElevation(t, plant.lat, plant.lon);
    const ghi = solar ? clearSkyGhi(elev) : 0;
    const physicalMaxMw = solar ? plant.capacity_mw * Math.min(1, (ghi / 1000) * PV_PERFORMANCE_RATIO * 1.15) : plant.capacity_mw;
    if (i < 96) dailyPotentialMwh += physicalMaxMw * 0.25;
    const inWindow = t.getTime() >= start.getTime() && t.getTime() <= effectiveEnd.getTime();
    const hour = i / 4;
    envelope.push({
      hour,
      label: `${String(Math.floor(hour) % 24).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
      ghi: Math.round(ghi),
      envelopeLow: Math.round(ghi * 0.82),
      envelopeHigh: Math.round(ghi * 1.06),
      physicalMaxMw: Number(physicalMaxMw.toFixed(3)),
      claimedMw: inWindow ? Number(claimedMw.toFixed(3)) : null,
    });
  }

  const discrepancyMwh = claimedMwh - physicalMaxMwh;
  const discrepancyPct = physicalMaxMwh > 0 ? (discrepancyMwh / physicalMaxMwh) * 100 : claimedMwh > 0 ? 100 : 0;
  const capacityFactor = claimedMwh / (plant.capacity_mw * windowHours);
  const nocturnal = solar && elevationAtClaim <= 0;

  let verdict: PhysicalReport["verdict"] = "consistent";
  if (nocturnal && claimedMwh > 0) verdict = "violation";
  else if (discrepancyMwh > 0.05 * Math.max(physicalMaxMwh, 0.001)) verdict = "violation";
  else if (claimedMwh > 0.85 * physicalMaxMwh) verdict = "marginal";

  return {
    plantType: plant.type,
    capacityMw: plant.capacity_mw,
    lat: plant.lat,
    lon: plant.lon,
    windowStart: start,
    windowEnd: effectiveEnd,
    windowHours,
    claimedMwh,
    claimedMw,
    physicalMaxMwh,
    dailyPotentialMwh,
    elevationAtClaim,
    ghiAtClaim,
    capacityFactor,
    discrepancyMwh,
    discrepancyPct,
    nocturnal,
    verdict,
    envelope,
  };
}

// ---------------------------------------------------------------------------
// The Signal Triangle — three independent pillars, each 0-100 (higher = more suspicious)

export type SignalPillars = {
  physical: number;
  statistical: number;
  network: number;
  composite: number;
};

export function signalPillars(cert: OnChainCertificate, report: PhysicalReport, peers: CertificateListItem[]): SignalPillars {
  // Physical: how far the claim sits past what physics allows.
  let physical: number;
  if (report.verdict === "violation") {
    physical = Math.min(99, 80 + Math.min(19, Math.abs(report.discrepancyPct) / 5));
  } else if (report.verdict === "marginal") {
    physical = 45 + 30 * Math.min(1, (report.claimedMwh / Math.max(report.physicalMaxMwh, 0.001) - 0.85) / 0.15);
  } else {
    physical = 5 + 35 * Math.min(1, report.claimedMwh / Math.max(report.physicalMaxMwh, 0.001));
  }

  // Statistical: the model's own score, the pillar the backend actually computes.
  const statistical = cert.fraud_score;

  // Network: concentration of this plant's certificates in one wallet, plus
  // any trading-graph reasons the backend attached.
  const samePlant = peers.filter((p) => p.plant_id === cert.plant_id);
  const sameOwner = samePlant.filter((p) => p.owner_address.toLowerCase() === cert.owner_address.toLowerCase());
  const concentration = samePlant.length > 1 ? sameOwner.length / samePlant.length : 0.3;
  const graphReason = cert.risk_reasons.some((r) => /trad|cycle|loop|graph|ring|wash/i.test(r));
  const network = Math.min(99, Math.round(12 + concentration * 38 + (graphReason ? 40 : 0) + (cert.fraud_score >= FRAUD_FLAG_THRESHOLD ? 8 : 0)));

  // Bayesian noisy-OR fusion: the chance at least one pillar is right to be suspicious.
  const composite = Math.round(100 * (1 - (1 - physical / 100) * (1 - statistical / 100) * (1 - network / 100) ** 0.5));

  return {
    physical: Math.round(physical),
    statistical: Math.round(statistical),
    network,
    composite: Math.min(99, Math.max(cert.fraud_score, composite)),
  };
}

// ---------------------------------------------------------------------------
// Registry-wide aggregates

export type AnomalyPoint = {
  tokenId: number;
  plantId: string;
  hour: number;
  score: number;
  energy: number;
  flagged: boolean;
};

/** Anomaly confidence (fraud score) against generation time of day, UTC. */
export function anomalyMatrix(certs: CertificateListItem[]): AnomalyPoint[] {
  return certs.map((c) => {
    const d = new Date(c.generation_timestamp);
    return {
      tokenId: c.token_id,
      plantId: c.plant_id,
      hour: Number((d.getUTCHours() + d.getUTCMinutes() / 60).toFixed(2)),
      score: c.fraud_score,
      energy: c.energy_mwh,
      flagged: c.fraud_score >= FRAUD_FLAG_THRESHOLD,
    };
  });
}

export type DailyPoint = { date: string; label: string; issued: number; flagged: number; mwh: number };

export function dailySeries(certs: CertificateListItem[]): DailyPoint[] {
  const byDay = new Map<string, DailyPoint>();
  for (const c of certs) {
    const date = new Date(c.created_at).toISOString().slice(0, 10);
    const point =
      byDay.get(date) ??
      {
        date,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date)),
        issued: 0,
        flagged: 0,
        mwh: 0,
      };
    point.issued += 1;
    point.mwh += c.energy_mwh;
    if (c.fraud_score >= FRAUD_FLAG_THRESHOLD) point.flagged += 1;
    byDay.set(date, point);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type HistogramBin = { range: string; from: number; count: number; tone: "low" | "medium" | "high" };

export function scoreHistogram(certs: CertificateListItem[], bins = 10): HistogramBin[] {
  const width = 100 / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => {
    const from = Math.round(i * width);
    return {
      range: `${from}–${Math.round(from + width)}`,
      from,
      count: 0,
      tone: from >= FRAUD_FLAG_THRESHOLD ? "high" : from >= 25 ? "medium" : "low",
    };
  });
  for (const c of certs) {
    out[Math.min(bins - 1, Math.floor(c.fraud_score / width))].count += 1;
  }
  return out;
}

export type PlantRollup = { plantId: string; certificates: number; mwh: number; maxScore: number; flagged: number };

export function plantRollup(certs: CertificateListItem[]): PlantRollup[] {
  const map = new Map<string, PlantRollup>();
  for (const c of certs) {
    const r = map.get(c.plant_id) ?? { plantId: c.plant_id, certificates: 0, mwh: 0, maxScore: 0, flagged: 0 };
    r.certificates += 1;
    r.mwh += c.energy_mwh;
    r.maxScore = Math.max(r.maxScore, c.fraud_score);
    if (c.fraud_score >= FRAUD_FLAG_THRESHOLD) r.flagged += 1;
    map.set(c.plant_id, r);
  }
  return [...map.values()].sort((a, b) => b.mwh - a.mwh);
}

export function riskSplit(certs: CertificateListItem[]) {
  let low = 0;
  let medium = 0;
  let high = 0;
  for (const c of certs) {
    if (c.fraud_score >= FRAUD_FLAG_THRESHOLD) high += 1;
    else if (c.fraud_score >= 25) medium += 1;
    else low += 1;
  }
  return { low, medium, high };
}

// ---------------------------------------------------------------------------
// Ownership graph (plants → holding wallets), from registry data

export type GraphNode = {
  id: string;
  kind: "plant" | "wallet";
  label: string;
  x: number;
  y: number;
  risk: number;
  mwh: number;
  certificates: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  mwh: number;
  certificates: number;
  risk: number;
};

/**
 * Bipartite plant → wallet graph laid out deterministically: wallets on an
 * inner ring, plants on an outer ring, each plant angled toward the wallet
 * holding most of its certificates so edges stay short and readable.
 */
export function ownershipGraph(certs: CertificateListItem[], width = 800, height = 560) {
  const cx = width / 2;
  const cy = height / 2;
  const plants = new Map<string, GraphNode>();
  const wallets = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const c of certs) {
    const wid = c.owner_address.toLowerCase();
    const plant = plants.get(c.plant_id) ?? { id: `p:${c.plant_id}`, kind: "plant", label: c.plant_id, x: 0, y: 0, risk: 0, mwh: 0, certificates: 0 };
    const wallet = wallets.get(wid) ?? { id: `w:${wid}`, kind: "wallet", label: c.owner_address, x: 0, y: 0, risk: 0, mwh: 0, certificates: 0 };
    plant.risk = Math.max(plant.risk, c.fraud_score);
    plant.mwh += c.energy_mwh;
    plant.certificates += 1;
    wallet.risk = Math.max(wallet.risk, c.fraud_score);
    wallet.mwh += c.energy_mwh;
    wallet.certificates += 1;
    plants.set(c.plant_id, plant as GraphNode);
    wallets.set(wid, wallet as GraphNode);

    const key = `${plant.id}->${wallet.id}`;
    const edge = edges.get(key) ?? { id: key, source: plant.id, target: wallet.id, mwh: 0, certificates: 0, risk: 0 };
    edge.mwh += c.energy_mwh;
    edge.certificates += 1;
    edge.risk = Math.max(edge.risk, c.fraud_score);
    edges.set(key, edge);
  }

  const walletList = [...wallets.values()].sort((a, b) => b.mwh - a.mwh);
  const innerR = walletList.length === 1 ? 0 : Math.min(width, height) * 0.16;
  walletList.forEach((w, i) => {
    const a = (i / walletList.length) * Math.PI * 2 - Math.PI / 2;
    w.x = cx + innerR * Math.cos(a);
    w.y = cy + innerR * Math.sin(a);
  });

  const plantList = [...plants.values()].sort((a, b) => b.risk - a.risk || b.mwh - a.mwh);
  const outerR = Math.min(width, height) * 0.4;
  plantList.forEach((p, i) => {
    const a = (i / plantList.length) * Math.PI * 2 - Math.PI / 2 + Math.PI / plantList.length;
    p.x = cx + outerR * Math.cos(a) * (width / height > 1.2 ? 1.25 : 1);
    p.y = cy + outerR * Math.sin(a);
  });

  return { nodes: [...walletList, ...plantList], edges: [...edges.values()] };
}

// ---------------------------------------------------------------------------
// Telemetry log for the investigation dossier: the claim window at 30-min
// resolution against the modelled physical ceiling.

export type TelemetryRow = {
  epoch: string;
  meterKw: number;
  physicalKw: number;
  ghi: number;
  status: "normal" | "marginal" | "violation";
};

export function telemetryRows(report: PhysicalReport): TelemetryRow[] {
  const rows: TelemetryRow[] = [];
  const start = report.windowStart.getTime() - 60 * 60_000;
  const end = report.windowEnd.getTime() + 60 * 60_000;
  for (let t = start; t <= end; t += 30 * 60_000) {
    const d = new Date(t);
    const inWindow = t >= report.windowStart.getTime() && t < report.windowEnd.getTime();
    const elev = solarElevation(d, report.lat, report.lon);
    const ghi = isSolar(report.plantType) ? clearSkyGhi(elev) : 0;
    const physicalKw = isSolar(report.plantType)
      ? report.capacityMw * 1000 * Math.min(1, (ghi / 1000) * PV_PERFORMANCE_RATIO * 1.15)
      : report.capacityMw * 1000;
    const meterKw = inWindow ? report.claimedMw * 1000 : 0;
    let status: TelemetryRow["status"] = "normal";
    if (meterKw > physicalKw * 1.05) status = "violation";
    else if (meterKw > physicalKw * 0.85 && meterKw > 0) status = "marginal";
    rows.push({
      epoch: d.toISOString().replace("T", " ").slice(0, 16),
      meterKw: Math.round(meterKw),
      physicalKw: Math.round(physicalKw),
      ghi: Math.round(ghi),
      status,
    });
  }
  return rows.slice(0, 12);
}

/** Short, stable pseudo-hash for display seals (not cryptographic). */
export function displayHash(input: string, length = 8): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 2246822507);
  }
  const hex = ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padEnd(16, "0");
  return hex.slice(0, length);
}

export function formatUtcClock(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  const time = date.toISOString().slice(11, 19);
  return `${day} ${month} ${date.getUTCFullYear()} ${time} UTC`;
}

export function formatCoord(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}
