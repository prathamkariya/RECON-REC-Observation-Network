"use client";

import { Activity, Factory } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { dailySeries, plantRollup } from "@/lib/analytics";
import { CHART, axisTick, colorForScore, tooltipStyle } from "@/lib/chart-theme";
import type { CertificateListItem } from "@/lib/types";

/** Daily issuance volume (area) with flagged certificates overlaid (line), and certified MWh (bars). */
export function IssuanceTrend({ certificates }: { certificates: CertificateListItem[] }) {
  const data = dailySeries(certificates);

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={Activity}
        eyebrow="Issuance cadence"
        title="Certified energy & flag rate"
        description="Daily certified MWh against issued and flagged certificate counts."
        actions={
          <div className="flex flex-wrap items-center gap-3 text-xs text-recon-ink-dim">
            <Legend color={CHART.primarySoft} label="MWh" square />
            <Legend color={CHART.primary} label="Issued" />
            <Legend color={CHART.risk} label="Flagged" />
          </div>
        }
      />
      {data.length === 0 ? (
        <Empty />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="issuedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis yAxisId="mwh" tick={axisTick} axisLine={false} tickLine={false} width={52} />
              <YAxis yAxisId="count" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={22} allowDecimals={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(19,27,46,0.03)" }} />
              <Bar yAxisId="mwh" dataKey="mwh" name="MWh" fill={CHART.primarySoft} fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={900} />
              <Area yAxisId="count" type="linear" dataKey="issued" name="Issued" stroke={CHART.primary} strokeWidth={2} fill="url(#issuedFill)" animationDuration={1100} />
              <Line yAxisId="count" type="linear" dataKey="flagged" name="Flagged" stroke={CHART.risk} strokeWidth={2} dot={{ r: 3, fill: CHART.risk, stroke: "#fff", strokeWidth: 1.5 }} animationDuration={1300} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

/** Certified MWh per plant, bar colored by the plant's worst certificate score. */
export function PlantEnergyBars({ certificates }: { certificates: CertificateListItem[] }) {
  const data = plantRollup(certificates).map((p) => ({ ...p, mwh: Math.round(p.mwh) }));

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={Factory}
        eyebrow="Asset exposure"
        title="Energy certified by plant"
        description="Bar tint is the worst risk score among that plant's certificates."
      />
      {data.length === 0 ? (
        <Empty />
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" horizontal={false} />
              <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="plantId" tick={{ ...axisTick, fontSize: 10, fill: CHART.inkSoft }} axisLine={false} tickLine={false} width={132} />
              <Tooltip
                {...tooltipStyle}
                cursor={{ fill: "rgba(19,27,46,0.03)" }}
                formatter={(value, name, item) => {
                  const p = item.payload as { certificates: number; maxScore: number };
                  return [`${Number(value).toLocaleString()} MWh · ${p.certificates} certs · max risk ${p.maxScore}`, "Certified"];
                }}
              />
              <Bar dataKey="mwh" radius={[0, 5, 5, 0]} maxBarSize={18} animationDuration={1000}>
                {data.map((p) => (
                  <Cell key={p.plantId} fill={colorForScore(p.maxScore)} fillOpacity={p.maxScore >= 50 ? 0.85 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function Legend({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={square ? "h-2.5 w-2.5 rounded-[3px]" : "h-0.5 w-3.5 rounded-full"} style={{ background: color }} />
      {label}
    </span>
  );
}

function Empty() {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-recon-ink/15 text-sm text-recon-ink-dim">
      No certificates issued yet.
    </div>
  );
}
