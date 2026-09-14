"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Factory, Maximize2, Minus, Plus, Wallet } from "lucide-react";
import type { GraphEdge, GraphNode } from "@/lib/analytics";
import { CHART, colorForScore } from "@/lib/chart-theme";
import { truncateAddress } from "@/lib/format";

const W = 800;
const H = 560;

/**
 * Plant → wallet custody graph. Edge width is certified MWh, color is the
 * worst score on that edge. Hovering a node isolates its neighbourhood;
 * clicking selects it for the inspector. Zoom is a plain SVG transform so
 * it stays crisp at any scale.
 */
export function EntityGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Only hover isolates a neighbourhood; the selection is marked with a ring so the
  // whole graph stays readable while the inspector shows one entity.
  const focus = hoverId;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbours = new Set<string>();
  if (focus) {
    neighbours.add(focus);
    for (const e of edges) {
      if (e.source === focus) neighbours.add(e.target);
      if (e.target === focus) neighbours.add(e.source);
    }
  }
  const maxMwh = Math.max(...edges.map((e) => e.mwh), 1);

  return (
    <div className="dot-well relative h-[460px] overflow-hidden rounded-xl border border-white/70 bg-white/30 sm:h-[560px]" data-lenis-prevent>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full touch-none select-none" role="img" aria-label={`Custody graph with ${nodes.length} entities and ${edges.length} holdings`}>
        <defs>
          <marker id="arrow-risk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={CHART.risk} />
          </marker>
          <marker id="arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={CHART.sage} />
          </marker>
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <motion.g
          animate={{ scale: zoom }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}
        >
          {edges.map((edge, i) => {
            const s = byId.get(edge.source);
            const t = byId.get(edge.target);
            if (!s || !t) return null;
            const risky = edge.risk >= 50;
            const dimmed = focus !== null && !(neighbours.has(edge.source) && neighbours.has(edge.target));
            // Gentle curve so parallel holdings don't overlap.
            const mx = (s.x + t.x) / 2 + (t.y - s.y) * 0.12;
            const my = (s.y + t.y) / 2 - (t.x - s.x) * 0.12;
            // Stop the line at the wallet's rim so the arrowhead is visible.
            const tr = 26;
            const dx = t.x - mx;
            const dy = t.y - my;
            const len = Math.hypot(dx, dy) || 1;
            const ex = t.x - (dx / len) * tr;
            const ey = t.y - (dy / len) * tr;
            const d = `M ${s.x} ${s.y} Q ${mx} ${my} ${ex} ${ey}`;
            return (
              <g key={edge.id} opacity={dimmed ? 0.12 : 1} style={{ transition: "opacity 0.3s ease" }}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={risky ? CHART.risk : CHART.sage}
                  strokeOpacity={risky ? 0.85 : 0.55}
                  strokeWidth={1.2 + (edge.mwh / maxMwh) * 4.5}
                  strokeDasharray={risky ? undefined : "0"}
                  markerEnd={risky ? "url(#arrow-risk)" : "url(#arrow-ink)"}
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, delay: 0.2 + i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                />
                {risky && !reduce && (
                  <circle r={3} fill={CHART.risk}>
                    <animateMotion dur={`${2.6 + (i % 4) * 0.4}s`} repeatCount="indefinite" path={d} />
                  </circle>
                )}
              </g>
            );
          })}

          {nodes.map((node, i) => {
            const isWallet = node.kind === "wallet";
            const r = isWallet ? 22 : 15 + Math.min(8, node.certificates * 1.5);
            const color = colorForScore(node.risk);
            const selected = node.id === selectedId;
            const dimmed = focus !== null && !neighbours.has(node.id);
            const label = isWallet ? truncateAddress(node.label) : node.label;
            return (
              <motion.g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${isWallet ? "Wallet" : "Plant"} ${label}, ${node.certificates} certificates, max risk ${node.risk}`}
                aria-pressed={selected}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(node.id)}
                onMouseEnter={() => setHoverId(node.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(node.id)}
                onBlur={() => setHoverId(null)}
                initial={reduce ? false : { opacity: 0, scale: 0.3 }}
                animate={{ opacity: dimmed ? 0.25 : 1, scale: 1 }}
                transition={{ delay: reduce ? 0 : 0.05 + i * 0.04, type: "spring", stiffness: 260, damping: 20 }}
                style={{ cursor: "pointer", outline: "none", transformOrigin: `${node.x}px ${node.y}px` }}
              >
                {node.risk >= 50 && <circle cx={node.x} cy={node.y} r={r + 8} fill={color} opacity={0.18} filter="url(#node-glow)" />}
                {selected && <circle cx={node.x} cy={node.y} r={r + 7} fill="none" stroke={CHART.ink} strokeWidth={1.5} strokeDasharray="3 3" />}
                {isWallet ? (
                  <rect x={node.x - r} y={node.y - r} width={r * 2} height={r * 2} rx={9} fill={node.risk >= 50 ? color : CHART.ink} stroke="#fff" strokeWidth={2.5} />
                ) : (
                  <circle cx={node.x} cy={node.y} r={r} fill="#fff" stroke={color} strokeWidth={3} />
                )}
                <foreignObject x={node.x - 9} y={node.y - 9} width={18} height={18} style={{ pointerEvents: "none" }}>
                  {isWallet ? <Wallet className="h-[18px] w-[18px] text-white" /> : <Factory className="h-[18px] w-[18px]" style={{ color }} />}
                </foreignObject>
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={node.x - (label.length * 6.4 + 14) / 2}
                    y={node.y + r + 6}
                    width={label.length * 6.4 + 14}
                    height={30}
                    rx={6}
                    fill="rgba(255,255,255,0.88)"
                    stroke="rgba(19,27,46,0.08)"
                  />
                  <text x={node.x} y={node.y + r + 18} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={CHART.ink} fontFamily="var(--font-plex-mono)">
                    {label}
                  </text>
                  <text x={node.x} y={node.y + r + 30} textAnchor="middle" fontSize={8.5} fill={node.risk >= 50 ? CHART.risk : CHART.steel} fontFamily="var(--font-plex-mono)">
                    {node.risk >= 50 ? `RISK ${node.risk} · ` : ""}
                    {node.certificates} CERT{node.certificates === 1 ? "" : "S"}
                  </text>
                </g>
              </motion.g>
            );
          })}
        </motion.g>
      </svg>

      <div className="glass glass-thick absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl p-1">
        <ZoomButton label="Zoom in" onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.2).toFixed(2)))}>
          <Plus className="h-4 w-4" />
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}>
          <Minus className="h-4 w-4" />
        </ZoomButton>
        <span className="mx-1 h-5 w-px bg-recon-ink/10" />
        <ZoomButton label="Reset zoom" onClick={() => setZoom(1)}>
          <Maximize2 className="h-4 w-4" />
        </ZoomButton>
        <span className="mono-micro px-2 text-recon-steel">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="glass glass-thick absolute right-3 bottom-3 hidden rounded-xl px-3.5 py-3 sm:block">
        <p className="label-caps mb-2 text-recon-steel">Node classification</p>
        <ul className="space-y-1.5 text-[12px] text-recon-ink-soft">
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-verified bg-white" /> Generating plant
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[4px] bg-recon-ink" /> Holding wallet
          </li>
          <li className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-risk" /> High-risk entity (≥ 50)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-[3px] w-4 rounded-full bg-risk" /> Flagged custody flow
          </li>
        </ul>
      </div>
    </div>
  );
}

function ZoomButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-lg text-recon-ink-soft transition-colors hover:bg-white/80 hover:text-recon-ink">
      {children}
    </button>
  );
}
