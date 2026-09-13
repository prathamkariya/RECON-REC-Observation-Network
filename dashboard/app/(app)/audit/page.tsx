"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, Fingerprint, Link2, Lock, ScrollText, Send, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { useLocalActivityLog } from "@/lib/activity-log";
import { StatCard } from "@/components/dashboard/stat-card";
import { MetaChip, PageHeader, Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge } from "@/components/glass/signal-badge";
import { ConsoleSkeleton, ErrorPanel } from "@/components/glass/states";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { displayHash } from "@/lib/analytics";
import { CHART, axisTick, tooltipStyle } from "@/lib/chart-theme";
import { formatMwh, truncateAddress, truncateHash } from "@/lib/format";
import { explorerTxUrl } from "@/lib/chain";
import { cn } from "cn";

type Kind = "mint" | "retired" | "transferred" | "duplicate_rejected";

type AuditEvent = {
  id: string;
  kind: Kind;
  time: string;
  tokenId?: number;
  plantId?: string;
  detail: string;
  txHash?: string;
  actor?: string;
  source: "registry" | "session";
};

const KIND_META: Record<Kind, { label: string; tone: "verified" | "ink" | "neutral" | "warn"; icon: typeof Link2 }> = {
  mint: { label: "Minted", tone: "verified", icon: Link2 },
  retired: { label: "Retired", tone: "ink", icon: Lock },
  transferred: { label: "Transferred", tone: "neutral", icon: Send },
  duplicate_rejected: { label: "Duplicate rejected", tone: "warn", icon: XCircle },
};

const FILTERS: { key: "all" | Kind; label: string }[] = [
  { key: "all", label: "All events" },
  { key: "mint", label: "Mints" },
  { key: "retired", label: "Retirements" },
  { key: "transferred", label: "Transfers" },
  { key: "duplicate_rejected", label: "Rejections" },
];

export default function AuditTrailPage() {
  const { data: certificates, isLoading, isError } = useCertificates();
  const local = useLocalActivityLog();
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const events = useMemo<AuditEvent[]>(() => {
    if (!certificates) return [];
    const registry: AuditEvent[] = certificates.flatMap((c) => {
      const mint: AuditEvent = {
        id: `mint-${c.token_id}`,
        kind: "mint",
        time: c.created_at,
        tokenId: c.token_id,
        plantId: c.plant_id,
        detail: `${formatMwh(c.energy_mwh)} certified · score ${c.fraud_score}`,
        txHash: c.mint_tx_hash,
        actor: c.owner_address,
        source: "registry",
      };
      // The list payload has no retirement timestamp, so the retirement is
      // shown at the mint time; the dossier has the retire transaction hash.
      return c.status === "retired"
        ? [mint, { ...mint, id: `retire-${c.token_id}`, kind: "retired" as const, detail: "Certificate consumed against a claim", txHash: undefined }]
        : [mint];
    });
    const session: AuditEvent[] = local
      .filter((e) => e.type !== "minted")
      .map((e) => ({
        id: e.id,
        kind: e.type as Kind,
        time: e.timestamp,
        tokenId: e.tokenId,
        plantId: e.plantId,
        detail: e.message,
        source: "session",
      }));
    return [...session, ...registry].sort((a, b) => (a.time < b.time ? 1 : -1));
  }, [certificates, local]);

  if (isLoading) return <ConsoleSkeleton kpis={4} />;
  if (isError || !certificates) return <ErrorPanel title="Couldn't load the audit trail" />;

  const visible = filter === "all" ? events : events.filter((e) => e.kind === filter);
  const perDay = new Map<string, { label: string; mint: number; retired: number }>();
  for (const e of events) {
    if (e.kind !== "mint" && e.kind !== "retired") continue;
    const day = e.time.slice(0, 10);
    const row = perDay.get(day) ?? {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(day)),
      mint: 0,
      retired: 0,
    };
    row[e.kind] += 1;
    perDay.set(day, row);
  }
  const chart = [...perDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
  const ledgerSeal = displayHash(events.map((e) => e.id + (e.txHash ?? "")).join("|"), 16);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <PageHeader
          crumbs={["REC Market", "Audit Trail"]}
          title="Every state change, in order."
          description="Mints and retirements come from the registry; transfers and rejected duplicates recorded in this browser session appear alongside them."
          meta={
            <MetaChip>
              <Fingerprint className="h-3.5 w-3.5 text-gold" />
              <span className="mono-micro">LEDGER SEAL 0x{ledgerSeal}</span>
            </MetaChip>
          }
        />
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label="Events" value={events.length} icon={ScrollText} footnote="Registry + session" footnoteValue="Ordered" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Mints" value={events.filter((e) => e.kind === "mint").length} icon={Link2} accent="verified" footnote="On-chain" footnoteValue="Sepolia" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Retirements" value={events.filter((e) => e.kind === "retired").length} icon={Lock} footnote="Consumed" footnoteValue="Final" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Session events"
            value={events.filter((e) => e.source === "session").length}
            icon={Send}
            accent="warn"
            footnote="This browser"
            footnoteValue="Local"
          />
        </StaggerItem>
      </Stagger>

      <Reveal>
        <Panel>
          <PanelHeader icon={BarChart3} eyebrow="Ledger cadence" title="Registry events per day" description="Mints and retirements by UTC day." />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 6, right: 6, left: -6, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(19,27,46,0.03)" }} />
                <Bar dataKey="mint" name="Mints" stackId="a" fill={CHART.primary} fillOpacity={0.75} maxBarSize={26} animationDuration={900} />
                <Bar dataKey="retired" name="Retirements" stackId="a" fill={CHART.ink} fillOpacity={0.8} radius={[5, 5, 0, 0]} maxBarSize={26} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </Reveal>

      <Reveal>
        <div className="glass glass-medium overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 border-b border-recon-ink/[0.07] p-4 sm:p-5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "h-8 rounded-full border px-3.5 text-xs font-medium transition-colors",
                  filter === f.key ? "border-recon-ink bg-recon-ink text-white" : "border-recon-ink/10 bg-white/60 text-recon-ink-soft hover:border-recon-ink/30",
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="mono-micro ml-auto text-recon-steel">{visible.length} EVENTS</span>
          </div>
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-recon-ink/[0.07] bg-white/40">
                  {["Time (UTC)", "Event", "Certificate", "Detail", "Holder", "Transaction"].map((h) => (
                    <th key={h} className="label-caps px-5 py-3 text-recon-steel">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-recon-ink-dim">
                      No events of this type yet.
                    </td>
                  </tr>
                ) : (
                  visible.map((e) => {
                    const meta = KIND_META[e.kind];
                    const Icon = meta.icon;
                    return (
                      <tr key={e.id} className="h-12 border-b border-recon-ink/[0.05] transition-colors last:border-0 hover:bg-white/50">
                        <td className="mono-micro px-5 whitespace-nowrap text-recon-steel">{e.time.slice(0, 16).replace("T", " ")}</td>
                        <td className="px-5">
                          <SignalBadge tone={meta.tone}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </SignalBadge>
                        </td>
                        <td className="px-5">
                          {e.tokenId !== undefined ? (
                            <Link href={`/certificates/${e.tokenId}`} className="mono-data font-semibold text-recon-ink hover:text-gold">
                              REC-{String(e.tokenId).padStart(5, "0")}
                            </Link>
                          ) : (
                            <span className="mono-micro text-recon-steel">—</span>
                          )}
                          {e.plantId && <span className="block text-[12px] text-recon-ink-dim">{e.plantId}</span>}
                        </td>
                        <td className="px-5 text-[13px] text-recon-ink-soft">{e.detail}</td>
                        <td className="mono-micro px-5 text-recon-steel">{e.actor ? truncateAddress(e.actor) : e.source === "session" ? "this session" : "—"}</td>
                        <td className="px-5">
                          {e.txHash ? (() => {
                            const url = explorerTxUrl(e.txHash);
                            return url ? (
                              <a href={url} target="_blank" rel="noreferrer" className="mono-micro inline-flex items-center gap-1 text-recon-ink-soft hover:text-gold">
                                {truncateHash(e.txHash)} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="mono-micro text-recon-steel" title={e.txHash}>{truncateHash(e.txHash)}</span>
                            );
                          })() : (
                            <span className="mono-micro text-recon-titanium">{e.kind === "retired" ? "see dossier" : "off-chain"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
