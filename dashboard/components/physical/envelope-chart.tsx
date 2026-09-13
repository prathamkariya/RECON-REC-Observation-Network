"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PhysicalReport } from "@/lib/analytics";
import { CHART, axisTick, tooltipStyle } from "@/lib/chart-theme";

/**
 * 24h confrontation chart for one certificate's UTC day:
 *  - modelled clear-sky GHI with its variance envelope (left axis, W/m²)
 *  - the plant's physical output ceiling (right axis, MW)
 *  - the certificate's claimed output across its window (right axis, MW)
 * A claim bar outside the ceiling is the violation, visible without reading a number.
 */
export function EnvelopeChart({ report, height = 340, compact = false }: { report: PhysicalReport; height?: number; compact?: boolean }) {
  const solar = report.plantType.toLowerCase().includes("solar");
  const windowFrom = report.windowStart.getUTCHours() + report.windowStart.getUTCMinutes() / 60;
  const windowToRaw = report.windowEnd.getUTCHours() + report.windowEnd.getUTCMinutes() / 60;
  const windowTo = windowToRaw <= windowFrom ? 24 : windowToRaw;
  const violation = report.verdict === "violation";
  const maxMw = Math.max(report.capacityMw, report.claimedMw) * 1.15;

  const data = report.envelope.map((p) => ({
    ...p,
    band: [p.envelopeLow, p.envelopeHigh] as [number, number],
  }));

  const sunrise = data.find((p) => p.ghi > 0)?.hour;
  const sunset = [...data].reverse().find((p) => p.ghi > 0)?.hour;
  const noon = solar ? data.reduce((best, p) => (p.ghi > best.ghi ? p : best), data[0]) : undefined;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: compact ? 8 : 24, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="ghiFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.04} />
            </linearGradient>
            <pattern id="violationHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={CHART.risk} strokeWidth="1.5" strokeOpacity="0.35" />
            </pattern>
          </defs>

          {solar && sunrise !== undefined && sunrise > 0 && <ReferenceArea yAxisId="ghi" x1={0} x2={sunrise} fill={CHART.ink} fillOpacity={0.035} />}
          {solar && sunset !== undefined && sunset < 24 && <ReferenceArea yAxisId="ghi" x1={sunset} x2={24} fill={CHART.ink} fillOpacity={0.035} />}

          <ReferenceArea
            yAxisId="mw"
            x1={windowFrom}
            x2={windowTo}
            y1={0}
            y2={report.claimedMw}
            fill={violation ? "url(#violationHatch)" : CHART.primarySoft}
            fillOpacity={violation ? 1 : 0.35}
            stroke={violation ? CHART.risk : CHART.primary}
            strokeWidth={1.5}
            strokeDasharray={violation ? "4 3" : undefined}
            ifOverflow="extendDomain"
          />

          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, 24]}
            ticks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
            tickFormatter={(h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:00`}
            tick={axisTick}
            axisLine={{ stroke: CHART.grid }}
            tickLine={false}
          />
          <YAxis
            yAxisId="ghi"
            domain={[0, 1100]}
            ticks={[0, 250, 500, 750, 1000]}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={compact ? 40 : 52}
            label={compact ? undefined : { value: "W/m²", angle: -90, position: "insideLeft", offset: 14, fill: CHART.steel, fontSize: 10, fontFamily: CHART.font }}
          />
          <YAxis
            yAxisId="mw"
            orientation="right"
            domain={[0, Number(maxMw.toFixed(1))]}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={compact ? 34 : 50}
            tickFormatter={(v: number) => Number(v).toFixed(v < 10 ? 1 : 0)}
            label={compact ? undefined : { value: "MW", angle: 90, position: "insideRight", offset: 14, fill: CHART.steel, fontSize: 10, fontFamily: CHART.font }}
          />

          <Tooltip
            {...tooltipStyle}
            labelFormatter={(h) => `${String(Math.floor(Number(h))).padStart(2, "0")}:${String(Math.round((Number(h) % 1) * 60)).padStart(2, "0")} UTC`}
            formatter={(value, name) => {
              if (name === "band") {
                const [lo, hi] = value as unknown as [number, number];
                return [`${lo}–${hi} W/m²`, "Envelope ±1.5σ"];
              }
              if (name === "ghi") return [`${value} W/m²`, "Clear-sky GHI"];
              if (name === "physicalMaxMw") return [`${value} MW`, "Physical ceiling"];
              if (name === "claimedMw") return [value === null ? "—" : `${value} MW`, "Claimed output"];
              return [String(value), String(name)];
            }}
          />

          {solar && <Area yAxisId="ghi" dataKey="band" stroke="none" fill={CHART.primarySoft} fillOpacity={0.35} isAnimationActive animationDuration={900} />}
          {solar && <Area yAxisId="ghi" dataKey="ghi" stroke={CHART.primary} strokeWidth={1.5} fill="url(#ghiFill)" animationDuration={1100} />}
          <Line yAxisId="mw" dataKey="physicalMaxMw" stroke={CHART.ink} strokeWidth={1.5} strokeDasharray="5 4" dot={false} animationDuration={1300} />
          <Line
            yAxisId="mw"
            dataKey="claimedMw"
            stroke={violation ? CHART.risk : CHART.verified}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            animationDuration={1500}
          />

          {!compact && solar && sunrise !== undefined && (
            <ReferenceLine yAxisId="ghi" x={sunrise} stroke={CHART.steel} strokeDasharray="2 4" label={{ value: "DAWN", position: "top", fill: CHART.steel, fontSize: 9, fontFamily: CHART.font }} />
          )}
          {!compact && noon && (
            <ReferenceLine yAxisId="ghi" x={noon.hour} stroke={CHART.steel} strokeDasharray="2 4" label={{ value: "SOLAR NOON", position: "top", fill: CHART.steel, fontSize: 9, fontFamily: CHART.font }} />
          )}
          {!compact && solar && sunset !== undefined && (
            <ReferenceLine yAxisId="ghi" x={sunset} stroke={CHART.steel} strokeDasharray="2 4" label={{ value: "DUSK", position: "top", fill: CHART.steel, fontSize: 9, fontFamily: CHART.font }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnvelopeLegend({ report }: { report: PhysicalReport }) {
  const solar = report.plantType.toLowerCase().includes("solar");
  const violation = report.verdict === "violation";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-recon-ink-dim">
      {solar && (
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-[3px] bg-gold/35" /> Clear-sky GHI (modelled)
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-[1.5px] border-dashed border-recon-ink" /> Physical ceiling (MW)
      </span>
      <span className={"flex items-center gap-1.5 font-medium " + (violation ? "text-risk" : "text-verified")}>
        <span className={"h-[3px] w-4 rounded-full " + (violation ? "bg-risk" : "bg-verified")} /> Claimed output (MW)
      </span>
    </div>
  );
}
