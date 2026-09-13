"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, MoonStar, ScatterChart as ScatterIcon, SunMedium } from "lucide-react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge, severityLabel, toneForScore } from "@/components/glass/signal-badge";
import { anomalyMatrix, type AnomalyPoint } from "@/lib/analytics";
import { CHART, axisTick, colorForScore, tooltipStyle } from "@/lib/chart-theme";
import { formatMwh } from "@/lib/format";
import { FRAUD_FLAG_THRESHOLD, type CertificateListItem } from "@/lib/types";

type ShapeProps = { cx?: number; cy?: number; payload?: AnomalyPoint; size?: number };

export function AnomalyMatrix({ certificates }: { certificates: CertificateListItem[] }) {
  const points = anomalyMatrix(certificates);
  const top = [...points].sort((a, b) => b.score - a.score)[0];
  const [selectedId, setSelectedId] = useState<number | undefined>(top?.tokenId);
  const selected = points.find((p) => p.tokenId === selectedId) ?? top;

  const nightHour = (h: number) => h < 1 || h > 14.5; // UTC ≈ 06:30–20:00 IST daylight on the Indian grid

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={ScatterIcon}
        title="Risk by time of day"
        description="Each dot is a certificate: its fraud score against the hour it was generated (UTC). Bigger dots carry more energy."
        actions={
          <div className="flex items-center gap-3 text-xs text-recon-ink-dim">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-risk" /> ≥{FRAUD_FLAG_THRESHOLD} flagged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8aa898]" /> Normal
            </span>
          </div>
        }
      />

      <div className="grid-well relative h-[280px] rounded-xl border border-white/70 p-2 sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" />
            <ReferenceArea
              y1={FRAUD_FLAG_THRESHOLD}
              y2={100}
              fill={CHART.risk}
              fillOpacity={0.06}
              stroke={CHART.risk}
              strokeOpacity={0.25}
              strokeDasharray="4 4"
              label={{
                value: `CRITICAL INTERVENTION BAND (SCORE ≥ ${FRAUD_FLAG_THRESHOLD})`,
                position: "insideTopLeft",
                fill: CHART.risk,
                fontSize: 9.5,
                fontFamily: CHART.font,
                fontWeight: 600,
              }}
            />
            {selected && (
              <ReferenceLine x={selected.hour} stroke={colorForScore(selected.score)} strokeDasharray="3 3" strokeOpacity={0.6} />
            )}
            <XAxis
              type="number"
              dataKey="hour"
              domain={[0, 24]}
              ticks={[0, 4, 8, 12, 16, 20, 24]}
              tickFormatter={(h: number) => `${String(h % 24).padStart(2, "0")}:00`}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
            />
            <YAxis type="number" dataKey="score" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} axisLine={false} tickLine={false} />
            <ZAxis type="number" dataKey="energy" range={[40, 360]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART.steel }}
              {...tooltipStyle}
              formatter={(value, name) => {
                if (name === "hour") return [`${Number(value).toFixed(2)} h UTC`, "Generated"];
                if (name === "score") return [`${value} / 100`, "Score"];
                return [formatMwh(Number(value)), "Energy"];
              }}
              labelFormatter={() => ""}
            />
            <Scatter
              data={points}
              isAnimationActive
              animationDuration={900}
              shape={(props: unknown) => {
                const { cx = 0, cy = 0, payload, size = 60 } = props as ShapeProps;
                if (!payload) return <g />;
                const r = Math.max(4, Math.sqrt(size / Math.PI) * 1.15);
                const isSelected = payload.tokenId === selected?.tokenId;
                const fill = payload.flagged ? CHART.risk : payload.score >= 25 ? CHART.warn : CHART.sage;
                return (
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Certificate #${payload.tokenId}, ${payload.plantId}, score ${payload.score}`}
                    onClick={() => setSelectedId(payload.tokenId)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(payload.tokenId)}
                    style={{ cursor: "pointer", outline: "none" }}
                  >
                    {isSelected && <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={fill} strokeOpacity={0.35} strokeWidth={2} />}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={fill}
                      fillOpacity={payload.flagged ? 0.9 : 0.55}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.tokenId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 flex flex-col gap-4 rounded-xl border border-white/80 bg-white/70 p-4 shadow-[inset_0_1px_0_#fff,0_10px_24px_-14px_rgba(19,27,46,0.3)] sm:flex-row sm:items-center"
          >
            <span
              className={
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl " +
                (selected.flagged ? "bg-risk/10 text-risk" : "bg-verified/10 text-verified")
              }
            >
              {nightHour(selected.hour) ? <MoonStar className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="mono-data font-semibold text-recon-ink">REC-{String(selected.tokenId).padStart(5, "0")}</span>
                <span className="text-sm font-medium text-recon-ink-soft">{selected.plantId}</span>
                <SignalBadge tone={toneForScore(selected.score)}>
                  Risk {selected.score} · {severityLabel(selected.score)}
                </SignalBadge>
              </p>
              <p className="mono-micro mt-1.5 text-recon-steel">
                GENERATED {String(Math.floor(selected.hour)).padStart(2, "0")}:
                {String(Math.round((selected.hour % 1) * 60)).padStart(2, "0")} UTC · {formatMwh(selected.energy).toUpperCase()}
              </p>
            </div>
            <Link
              href={`/certificates/${selected.tokenId}`}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-recon-forest px-4 text-sm font-medium text-white transition-colors hover:bg-[#1b4332]"
            >
              Inspect dossier <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
