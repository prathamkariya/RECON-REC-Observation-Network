"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertOctagon, ArrowRight, CircleDot, GitBranch, History, Network, Repeat2, ScanSearch } from "lucide-react";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { EntityGraph } from "@/components/network/entity-graph";
import { LiveDot, Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge, severityLabel, toneForScore } from "@/components/glass/signal-badge";
import { ConsoleSkeleton, ErrorPanel } from "@/components/glass/states";
import { Reveal } from "@/components/motion/reveal";
import { ownershipGraph } from "@/lib/analytics";
import { formatMwh, truncateAddress } from "@/lib/format";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

export default function NetworkPage() {
  const { data: certificates, isLoading, isError } = useCertificates();
  const [pickedId, setPickedId] = useState<string | undefined>();

  if (isLoading) return <ConsoleSkeleton kpis={4} />;
  if (isError || !certificates) return <ErrorPanel title="Couldn't load the network graph" />;
  if (!certificates.length) return <ErrorPanel title="No certificates yet">The custody graph appears once certificates are issued.</ErrorPanel>;

  const { nodes, edges } = ownershipGraph(certificates);

  // Default focus: the riskiest wallet that isn't the dominant custodian, else the riskiest node.
  const holdCount = new Map(nodes.map((n) => [n.id, n.certificates]));
  const custodianId = nodes.filter((n) => n.kind === "wallet").sort((a, b) => b.certificates - a.certificates)[0]?.id;
  const defaultId =
    nodes.filter((n) => n.kind === "wallet" && n.id !== custodianId && n.risk >= FRAUD_FLAG_THRESHOLD).sort((a, b) => b.risk - a.risk)[0]?.id ??
    [...nodes].sort((a, b) => b.risk - a.risk)[0]?.id;
  const selectedId = pickedId && holdCount.has(pickedId) ? pickedId : defaultId;
  const selected = nodes.find((n) => n.id === selectedId)!;

  const isWallet = selected.kind === "wallet";
  const key = selected.id.slice(2);
  const related = certificates
    .filter((c) => (isWallet ? c.owner_address.toLowerCase() === key : c.plant_id === key))
    .sort((a, b) => (a.generation_timestamp < b.generation_timestamp ? -1 : 1));
  const counterparties = new Set(related.map((c) => (isWallet ? c.plant_id : c.owner_address.toLowerCase()))).size;
  const flagged = related.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const flaggedShare = related.length ? flagged.length / related.length : 0;
  const totalVolume = certificates.reduce((s, c) => s + c.energy_mwh, 0);
  const flaggedEdges = edges.filter((e) => e.risk >= FRAUD_FLAG_THRESHOLD).length;
  const timeline = related.slice(-4);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="glass glass-medium grid gap-5 rounded-2xl p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="label-caps flex flex-wrap items-center gap-1.5 text-recon-steel">
              REC Market <span className="text-recon-titanium">/</span> <span className="text-gold">Network Intelligence</span>
              <span className="text-recon-titanium">/</span> Custody analysis
            </p>
            <h1 className="mt-2 text-[28px] leading-9 font-bold tracking-tight text-recon-ink sm:text-[36px] sm:leading-[44px]">
              Entity Graph &amp; Custody Flows
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-recon-ink-dim">
              Topological surveillance of where certified energy comes from and where it accumulates — every node and edge is a real
              plant, wallet or holding on the registry.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-white/80 bg-white/55 p-4 shadow-[inset_0_1px_0_#fff]">
            <div>
              <p className="label-caps text-recon-steel">Target node</p>
              <p className="mono-data mt-1 flex items-center gap-1.5 font-semibold text-recon-ink">
                <CircleDot className="h-3.5 w-3.5 text-gold" /> {isWallet ? truncateAddress(selected.label) : selected.label}
              </p>
            </div>
            <div>
              <p className="label-caps text-recon-steel">Entities</p>
              <p className="mono-data mt-1 text-recon-ink">
                {nodes.filter((n) => n.kind === "plant").length} plants · {nodes.filter((n) => n.kind === "wallet").length} wallets
              </p>
            </div>
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
              <SignalBadge tone={flaggedEdges ? "risk" : "verified"}>
                <LiveDot tone={flaggedEdges ? "risk" : "verified"} className="h-1.5 w-1.5" /> {flaggedEdges} flagged flows
              </SignalBadge>
              <span className="mono-micro text-recon-steel">{formatMwh(totalVolume)} TOTAL</span>
            </div>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Reveal>
          <Panel className="h-full">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SignalBadge tone={flaggedEdges ? "solid-risk" : "verified"}>
                {flaggedEdges ? "Flagged custody detected" : "No flagged custody"}
              </SignalBadge>
              <span className="mono-micro rounded-[3px] border border-recon-ink/10 bg-white/60 px-2 py-1 text-recon-steel">
                TOTAL VOLUME: <span className="text-recon-ink">{formatMwh(totalVolume)}</span> · HOLDINGS: <span className="text-recon-ink">{edges.length}</span>
              </span>
            </div>
            <EntityGraph nodes={nodes} edges={edges} selectedId={selectedId} onSelect={setPickedId} />
            <p className="mono-micro mt-3 text-recon-steel">Hover a node to isolate its neighbourhood · click to inspect · edge width = certified MWh</p>
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel className="flex h-full flex-col">
            <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SignalBadge tone={selected.risk >= FRAUD_FLAG_THRESHOLD ? "risk" : "neutral"}>
                    {selected.risk >= FRAUD_FLAG_THRESHOLD ? "Critical target" : isWallet ? "Holding wallet" : "Generating plant"}
                  </SignalBadge>
                  <h2 className="mt-2 text-xl leading-7 font-semibold break-words text-recon-ink">{isWallet ? truncateAddress(selected.label, 6) : selected.label}</h2>
                  <p className="mono-micro mt-1 truncate text-recon-steel">{isWallet ? selected.label : "Registry plant record"}</p>
                </div>
                <div className="shrink-0 rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-center">
                  <p className="label-caps text-risk">Risk</p>
                  <p className={"font-display text-3xl leading-none font-bold " + (selected.risk >= 50 ? "text-risk" : "text-recon-ink")}>{selected.risk}</p>
                  <p className="mono-micro text-recon-steel">/100</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <InspectorStat label="Certificates" value={String(related.length)} sub={formatMwh(selected.mwh)} />
                <InspectorStat label={isWallet ? "Source plants" : "Holders"} value={String(counterparties)} sub={isWallet ? "co-mingled" : "wallets"} />
                <InspectorStat label="Flagged" value={String(flagged.length)} sub={`${Math.round(flaggedShare * 100)}% of holdings`} risk={flagged.length > 0} />
                <InspectorStat label="Worst case" value={severityLabel(selected.risk)} sub={`score ${selected.risk}`} risk={selected.risk >= 50} />
              </div>

              <div className="mt-4 rounded-xl border border-white/80 bg-white/55 p-3">
                <div className="flex items-center justify-between">
                  <span className="label-caps text-recon-steel">Flagged share</span>
                  <span className="mono-micro font-semibold text-risk">{Math.round(flaggedShare * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-recon-ink/[0.07]">
                  <motion.div
                    key={selected.id}
                    className="h-full rounded-full bg-gradient-to-r from-warn to-risk"
                    initial={{ width: 0 }}
                    animate={{ width: `${flaggedShare * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              <p className="label-caps mt-5 mb-2 text-recon-steel">Topological violations</p>
              {flagged.length === 0 ? (
                <p className="rounded-xl border border-dashed border-recon-ink/15 p-4 text-center text-[13px] text-recon-ink-dim">No flagged certificates on this entity.</p>
              ) : (
                <ul className="space-y-2">
                  {flagged
                    .sort((a, b) => b.fraud_score - a.fraud_score)
                    .slice(0, 3)
                    .map((c) => (
                      <li key={c.token_id}>
                        <Link href={`/certificates/${c.token_id}`} className="group flex items-start gap-2.5 rounded-xl border border-risk/15 bg-risk/[0.05] p-3 transition-colors hover:bg-risk/[0.09]">
                          <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-risk">
                              REC-{String(c.token_id).padStart(5, "0")} · score {c.fraud_score}
                            </span>
                            <span className="block text-[12px] text-recon-ink-dim">
                              {formatMwh(c.energy_mwh)} from {c.plant_id} held by {truncateAddress(c.owner_address)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}

              <div className="mt-auto space-y-2 pt-5">
                {flagged[0] && (
                  <Link
                    href={`/certificates/${[...flagged].sort((a, b) => b.fraud_score - a.fraud_score)[0].token_id}`}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-recon-forest text-sm font-semibold text-white hover:bg-[#1b4332]"
                  >
                    <ScanSearch className="h-4 w-4" /> Investigate worst certificate
                  </Link>
                )}
                <Link
                  href={`/certificates?q=${encodeURIComponent(isWallet ? selected.label : selected.label)}`}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 text-sm font-medium text-recon-ink hover:border-recon-ink/40"
                >
                  <GitBranch className="h-4 w-4" /> View all holdings
                </Link>
              </div>
            </motion.div>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel>
          <PanelHeader
            icon={History}
            title={
              <span className="flex flex-wrap items-center gap-2">
                Custody timeline: {isWallet ? truncateAddress(selected.label) : selected.label}
                {flagged.length > 0 && <SignalBadge tone="solid-risk">{flagged.length} flagged</SignalBadge>}
              </span>
            }
            description="Chronological ledger of this entity's most recent certificates · ordered by generation time"
            actions={<span className="mono-micro rounded-[3px] border border-recon-ink/10 bg-white/60 px-2 py-1 text-recon-ink-soft">{related.length} RECORDS</span>}
          />
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {timeline.map((c, i) => {
              const risky = c.fraud_score >= FRAUD_FLAG_THRESHOLD;
              return (
                <motion.li
                  key={c.token_id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative rounded-xl border border-white/80 bg-white/60 p-4 shadow-[inset_0_1px_0_#fff]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <SignalBadge tone={risky ? "risk" : c.status === "retired" ? "ink" : "verified"}>
                      Step {String(i + 1).padStart(2, "0")} · {risky ? "Flagged" : c.status === "retired" ? "Retired" : "Issued"}
                    </SignalBadge>
                    <span className="mono-micro text-recon-steel">{new Date(c.generation_timestamp).toISOString().slice(5, 16).replace("T", " ")}</span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-[13px] text-recon-ink-soft">
                    <span className={risky ? "font-semibold text-risk" : "font-medium"}>{c.plant_id}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-recon-steel" />
                    <span className="mono-micro">{truncateAddress(c.owner_address)}</span>
                  </p>
                  <dl className="mt-3 space-y-1 border-t border-recon-ink/[0.06] pt-2">
                    <div className="flex justify-between">
                      <dt className="mono-micro text-recon-steel">VOLUME</dt>
                      <dd className="mono-micro font-semibold text-recon-ink">{formatMwh(c.energy_mwh)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="mono-micro text-recon-steel">RISK</dt>
                      <dd className={"mono-micro font-semibold " + (risky ? "text-risk" : "text-recon-ink")}>
                        <SignalBadge tone={toneForScore(c.fraud_score)} className="h-[18px]">
                          {c.fraud_score}
                        </SignalBadge>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="mono-micro text-recon-steel">HASH</dt>
                      <dd className="mono-micro text-recon-ink-soft">
                        <Link href={`/certificates/${c.token_id}`} className="hover:text-gold">
                          {c.mint_tx_hash.slice(0, 6)}…{c.mint_tx_hash.slice(-4)}
                        </Link>
                      </dd>
                    </div>
                  </dl>
                </motion.li>
              );
            })}
          </ol>
          <p className="mono-micro mt-4 flex items-center gap-2 text-recon-steel">
            <Repeat2 className="h-3.5 w-3.5" /> Transfers between wallets aren&apos;t recorded as separate events by the registry API, so custody is shown as current holdings.
            <Network className="ml-auto hidden h-3.5 w-3.5 sm:block" />
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}

function InspectorStat({ label, value, sub, risk }: { label: string; value: string; sub: string; risk?: boolean }) {
  return (
    <div className={"rounded-xl border p-3 " + (risk ? "border-risk/15 bg-risk/[0.05]" : "border-white/80 bg-white/55")}>
      <p className="label-caps text-recon-steel">{label}</p>
      <p className={"mono-data mt-1 font-semibold " + (risk ? "text-risk" : "text-recon-ink")}>{value}</p>
      <p className="mono-micro text-recon-steel">{sub}</p>
    </div>
  );
}
