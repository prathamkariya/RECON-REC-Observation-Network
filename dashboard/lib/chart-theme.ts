// Shared Recharts styling so every chart reads as the same instrument.

export const CHART = {
  ink: "#131b2e",
  inkSoft: "#283044",
  dim: "#5a6270",
  steel: "#767775",
  grid: "rgba(19, 27, 46, 0.07)",
  primary: "#3c6450",
  primarySoft: "#a5d0b8",
  verified: "#2f7a57",
  sage: "#8aa898",
  warn: "#9a6a14",
  risk: "#b3261e",
  riskSoft: "rgba(179, 38, 30, 0.1)",
  font: "var(--font-plex-mono), ui-monospace, monospace",
} as const;

export const axisTick = { fill: CHART.steel, fontSize: 10.5, fontFamily: CHART.font } as const;

export const tooltipStyle = {
  contentStyle: {
    background: "rgba(255, 255, 255, 0.86)",
    backdropFilter: "blur(16px) saturate(180%)",
    WebkitBackdropFilter: "blur(16px) saturate(180%)",
    border: "1px solid rgba(19, 27, 46, 0.1)",
    borderRadius: 10,
    boxShadow: "0 12px 32px -12px rgba(19, 27, 46, 0.25)",
    fontSize: 12,
    fontFamily: CHART.font,
    color: CHART.ink,
    padding: "8px 10px",
  },
  labelStyle: { color: CHART.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: CHART.inkSoft, padding: 0 },
} as const;

export function colorForScore(score: number): string {
  if (score >= 50) return CHART.risk;
  if (score >= 25) return CHART.warn;
  return CHART.verified;
}
