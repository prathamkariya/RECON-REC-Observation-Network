"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Triangle } from "lucide-react";
import { Panel, PanelHeader } from "@/components/glass/panel";
import type { PhysicalReport, SignalPillars } from "@/lib/analytics";
import { colorForScore } from "@/lib/chart-theme";

const W = 420;
const H = 360;
const CX = W / 2;
const CY = 205;
const R = 150;

// Vertices: physical (top), network (bottom-left), statistical (bottom-right).
const VERTICES = {
  physical: { x: CX, y: CY - R },
  network: { x: CX - R * Math.cos(Math.PI / 6), y: CY + R * Math.sin(Math.PI / 6) },
  statistical: { x: CX + R * Math.cos(Math.PI / 6), y: CY + R * Math.sin(Math.PI / 6) },
};

function toward(v: { x: number; y: number }, amount: number) {
  return { x: CX + (v.x - CX) * amount, y: CY + (v.y - CY) * amount };
}

/**
 * The Signal Triangle Matrix: three independent surveillance vectors as the
 * corners of a triangle. The inner polygon's reach toward each corner is that
 * pillar's suspicion; a polygon pulled hard toward every corner is a
 * certificate all three methods independently distrust.
 */
export function SignalTriangle({ tokenId, pillars, report }: { tokenId: number; pillars: SignalPillars; report: PhysicalReport }) {
  const reduce = useReducedMotion();
  const p = toward(VERTICES.physical, Math.max(0.08, pillars.physical / 100));
  const n = toward(VERTICES.network, Math.max(0.08, pillars.network / 100));
  const s = toward(VERTICES.statistical, Math.max(0.08, pillars.statistical / 100));
  const compositeColor = colorForScore(pillars.composite);

  const polygon = `${p.x},${p.y} ${n.x},${n.y} ${s.x},${s.y}`;
  const collapsed = `${CX},${CY} ${CX},${CY} ${CX},${CY}`;

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={Triangle}
        title="Three independent checks"
        description={`How strongly physics, statistics and custody each point to fraud for REC-${String(tokenId).padStart(5, "0")}. A larger shape means more suspicion.`}
      />

      <div className="grid-well relative overflow-hidden rounded-xl border border-white/70">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Physical ${pillars.physical}, network ${pillars.network}, statistical ${pillars.statistical}, composite ${pillars.composite}`}>
          {[1, 0.66, 0.33].map((k) => (
            <polygon
              key={k}
              points={`${toward(VERTICES.physical, k).x},${toward(VERTICES.physical, k).y} ${toward(VERTICES.network, k).x},${toward(VERTICES.network, k).y} ${toward(VERTICES.statistical, k).x},${toward(VERTICES.statistical, k).y}`}
              fill="none"
              stroke="rgba(19,27,46,0.12)"
              strokeDasharray={k === 1 ? undefined : "3 4"}
            />
          ))}
          {Object.values(VERTICES).map((v, i) => (
            <line key={i} x1={CX} y1={CY} x2={v.x} y2={v.y} stroke="rgba(19,27,46,0.08)" />
          ))}

          <motion.polygon
            points={polygon}
            initial={reduce ? false : { points: collapsed, opacity: 0 }}
            animate={{ points: polygon, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            fill={compositeColor}
            fillOpacity={0.12}
            stroke={compositeColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {[
            { key: "physical", pt: p, value: pillars.physical },
            { key: "network", pt: n, value: pillars.network },
            { key: "statistical", pt: s, value: pillars.statistical },
          ].map((item, i) => (
            <motion.g
              key={item.key}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 300, damping: 18 }}
              style={{ transformOrigin: `${item.pt.x}px ${item.pt.y}px` }}
            >
              <circle cx={item.pt.x} cy={item.pt.y} r={15} fill={colorForScore(item.value)} stroke="#fff" strokeWidth={2.5} />
              <text x={item.pt.x} y={item.pt.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="var(--font-plex-mono)">
                {item.value}
              </text>
            </motion.g>
          ))}

          <g>
            <circle cx={CX} cy={CY} r={30} fill="#0f2a20" stroke={compositeColor} strokeWidth={2.5} />
            <circle cx={CX} cy={CY} r={36} fill="none" stroke={compositeColor} strokeOpacity={0.3} strokeWidth={1.5} />
            <text x={CX} y={CY - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" fontFamily="var(--font-plex-mono)">
              {pillars.composite}
            </text>
            <text x={CX} y={CY + 11} textAnchor="middle" fontSize={7} letterSpacing={0.8} fill="#a5d0b8" fontFamily="var(--font-plex-mono)">
              COMPOSITE
            </text>
          </g>

          <VertexLabel x={VERTICES.physical.x} y={VERTICES.physical.y - 30} anchor="middle" title="PHYSICAL VECTOR" sub={`${pillars.physical}/100 · ${report.ghiAtClaim.toFixed(0)} W/m²`} />
          <VertexLabel x={VERTICES.network.x - 4} y={VERTICES.network.y + 34} anchor="start" title="NETWORK VECTOR" sub={`${pillars.network}/100 · custody`} />
          <VertexLabel x={VERTICES.statistical.x + 4} y={VERTICES.statistical.y + 34} anchor="end" title="STATISTICAL VECTOR" sub={`${pillars.statistical}/100 · model`} />
        </svg>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <MiniStat label="Physics veracity" value={report.verdict === "violation" ? "Violation" : report.verdict === "marginal" ? "Marginal" : "Consistent"} detail={`Elevation ${report.elevationAtClaim.toFixed(1)}° at claim`} risk={report.verdict === "violation"} />
        <MiniStat label="Capacity factor" value={`${(report.capacityFactor * 100).toFixed(0)}%`} detail={`${report.capacityMw} MW nameplate`} risk={report.capacityFactor > 1} />
        <MiniStat label="Model confidence" value={`${pillars.statistical}/100`} detail="Backend fraud score" risk={pillars.statistical >= 50} />
      </div>
    </Panel>
  );
}

function VertexLabel({ x, y, anchor, title, sub }: { x: number; y: number; anchor: "start" | "middle" | "end"; title: string; sub: string }) {
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor} fontSize={10} fontWeight={700} letterSpacing={0.7} fill="#283044" fontFamily="var(--font-inter)">
        {title}
      </text>
      <text x={x} y={y + 13} textAnchor={anchor} fontSize={9.5} fill="#767775" fontFamily="var(--font-plex-mono)">
        {sub}
      </text>
    </g>
  );
}

function MiniStat({ label, value, detail, risk }: { label: string; value: string; detail: string; risk: boolean }) {
  return (
    <div className={"rounded-xl border p-3 " + (risk ? "border-risk/20 bg-risk/[0.05]" : "border-white/80 bg-white/55")}>
      <p className={"text-xs font-semibold " + (risk ? "text-risk" : "text-verified")}>{label}</p>
      <p className="mono-data mt-1 text-recon-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-recon-ink-dim">{detail}</p>
    </div>
  );
}
