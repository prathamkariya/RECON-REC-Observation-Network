"use client";

import { BarChart3, PieChart as PieIcon, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { dailySeries, riskSplit, scoreHistogram } from "@/lib/analytics";
import { CHART, axisTick, tooltipStyle } from "@/lib/chart-theme";
import { FRAUD_FLAG_THRESHOLD, type CertificateListItem } from "@/lib/types";

const TONE_COLOR = { low: CHART.verified, medium: CHART.warn, high: CHART.risk };

/** Score histogram in 10-point bins, with the flag threshold marked. */
export function RiskDistributionChart({ certificates }: { certificates: CertificateListItem[] }) {
  const data = scoreHistogram(certificates);
  return (
    <Panel className="h-full">
      <PanelHeader
        icon={BarChart3}
        eyebrow="Distribution"
        title="Fraud score histogram"
        description={`Certificates per 10-point score band. Everything right of the line (≥ ${FRAUD_FLAG_THRESHOLD}) is flagged.`}
      />
      <div className="h-[270px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 6, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="range" tick={{ ...axisTick, fontSize: 9.5 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
            <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(19,27,46,0.03)" }} formatter={(v) => [`${v} certificates`, "Count"]} labelFormatter={(l) => `Score ${l}`} />
            <ReferenceLine
              x={`${FRAUD_FLAG_THRESHOLD}–${FRAUD_FLAG_THRESHOLD + 10}`}
              stroke={CHART.risk}
              strokeDasharray="4 4"
              label={{ value: "FLAG THRESHOLD", position: "top", fill: CHART.risk, fontSize: 9.5, fontFamily: CHART.font, fontWeight: 600 }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38} animationDuration={900}>
              {data.map((bin) => (
                <Cell key={bin.range} fill={TONE_COLOR[bin.tone]} fillOpacity={bin.tone === "low" ? 0.55 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/** Low / medium / high split as a donut with the flag rate in the middle. */
export function RiskSplitDonut({ certificates }: { certificates: CertificateListItem[] }) {
  const split = riskSplit(certificates);
  const total = certificates.length || 1;
  const data = [
    { name: "Low risk", value: split.low, color: CHART.verified },
    { name: "Watch", value: split.medium, color: CHART.warn },
    { name: "Flagged", value: split.high, color: CHART.risk },
  ];

  return (
    <Panel className="h-full">
      <PanelHeader icon={PieIcon} eyebrow="Composition" title="Registry risk mix" />
      <div className="relative h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} (${Math.round((Number(v) / total) * 100)}%)`, n]} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2.5} cornerRadius={6} stroke="rgba(255,255,255,0.9)" strokeWidth={2} animationDuration={1000}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} fillOpacity={0.85} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Centre readout as HTML over the chart: exact centring without relying on the chart's label geometry. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[28px] leading-none font-bold text-recon-ink">{Math.round((split.high / total) * 100)}%</span>
          <span className="mono-micro mt-1 text-recon-steel">FLAG RATE</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-recon-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.name}
            </span>
            <span className="mono-data text-recon-ink">
              {d.value} <span className="text-recon-steel">· {Math.round((d.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Cumulative flag rate by issuance day — is the problem growing or shrinking? */
export function FlagRateTrend({ certificates }: { certificates: CertificateListItem[] }) {
  const data = dailySeries(certificates).reduce<{ label: string; rate: number; flagged: number; issuedToDate: number; flaggedToDate: number }[]>(
    (rows, d) => {
      const prev = rows[rows.length - 1];
      const issuedToDate = (prev?.issuedToDate ?? 0) + d.issued;
      const flaggedToDate = (prev?.flaggedToDate ?? 0) + d.flagged;
      return [...rows, { label: d.label, rate: Number(((flaggedToDate / issuedToDate) * 100).toFixed(1)), flagged: d.flagged, issuedToDate, flaggedToDate }];
    },
    [],
  );

  return (
    <Panel className="h-full">
      <PanelHeader icon={TrendingUp} eyebrow="Trajectory" title="Cumulative flag rate" description="Share of all certificates issued to date that are flagged." />
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.risk} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART.risk} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={18} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => `${v}%`} domain={[0, "auto"]} />
            <Tooltip {...tooltipStyle} formatter={(v, n) => (n === "rate" ? [`${v}%`, "Flag rate"] : [v, "Flagged that day"])} />
            <Area type="monotone" dataKey="rate" stroke={CHART.risk} strokeWidth={2} fill="url(#rateFill)" animationDuration={1200} dot={{ r: 2.5, fill: CHART.risk, stroke: "#fff", strokeWidth: 1 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
