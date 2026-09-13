"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Link2, Lock, MapPin, Send, SunMedium } from "lucide-react";
import { useCertificate, useCertificates } from "@/lib/hooks/use-certificates";
import { OnChainProofPanel } from "@/components/certificate/onchain-proof-panel";
import { TransferPanel } from "@/components/certificate/transfer-dialog";
import { LifecycleTimeline } from "@/components/certificate/lifecycle-timeline";
import { SignalTriangle } from "@/components/investigation/signal-triangle";
import { EvidencePillars } from "@/components/investigation/evidence-pillars";
import { EnvelopeChart, EnvelopeLegend } from "@/components/physical/envelope-chart";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge, severityLabel, toneForScore } from "@/components/glass/signal-badge";
import { ConsoleSkeleton, ErrorPanel } from "@/components/glass/states";
import { Reveal } from "@/components/motion/reveal";
import { formatCoord, physicalReport, signalPillars } from "@/lib/analytics";
import { certificateSerial, formatDateTime, formatMwh, truncateAddress } from "@/lib/format";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { ApiError } from "@/lib/api-error";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

export default function CertificatePage() {
  const params = useParams<{ id: string }>();
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const tokenId = Number(params.id);
  const { data: certificate, isLoading, isError, error } = useCertificate(tokenId);
  const { data: peers = [] } = useCertificates();
  const queryClient = useQueryClient();

  const retireMutation = useMutation({
    mutationFn: () => api.retireCertificate(tokenId),
    onSuccess: () => {
      setConfirmRetire(false);
      logActivity({ type: "retired", tokenId, message: `Certificate #${tokenId} retired` });
      queryClient.invalidateQueries({ queryKey: ["certificate", tokenId] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  if (isLoading) return <ConsoleSkeleton />;

  if (isError || !certificate) {
    return (
      <ErrorPanel title={error instanceof ApiError && error.isNotFound ? `No certificate found for token #${params.id}` : "Couldn't load this certificate"}>
        <Link href="/certificates" className="font-medium text-gold hover:underline">
          Back to all certificates
        </Link>
      </ErrorPanel>
    );
  }

  const report = physicalReport(certificate);
  const pillars = signalPillars(certificate, report, peers);
  const flagged = pillars.composite >= FRAUD_FLAG_THRESHOLD;
  const serial = certificateSerial(certificate.token_id);
  const samePlant = peers.filter((p) => p.plant_id === certificate.plant_id);
  const ownerShare = {
    held: samePlant.filter((p) => p.owner_address.toLowerCase() === certificate.owner_address.toLowerCase()).length,
    ofPlant: samePlant.length,
  };
  const canAct = certificate.status === "issued";
  const verdictTone = report.verdict === "violation" ? "risk" : report.verdict === "marginal" ? "warn" : "verified";

  async function copyVerifyLink() {
    const url = `${window.location.origin}/verify?id=${certificate!.token_id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Verification link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Reveal y={10}>
        <div className="glass glass-medium flex flex-col gap-4 rounded-2xl p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Link href="/certificates" className="inline-flex items-center gap-1.5 text-xs font-medium text-recon-steel hover:text-gold">
              <ArrowLeft className="h-3.5 w-3.5" /> All certificates
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2.5">
              <h1 className="mono-data !text-[24px] !leading-8 font-semibold tracking-tight text-recon-ink sm:!text-[28px]">{serial}</h1>
              <SignalBadge tone={flagged ? "solid-risk" : "verified"}>{flagged ? `Flagged · ${severityLabel(pillars.composite)}` : "Clear"}</SignalBadge>
              <SignalBadge tone={certificate.status === "retired" ? "ink" : "neutral"}>{certificate.status}</SignalBadge>
            </div>
            <p className="mt-1.5 text-sm text-recon-ink-dim">
              {certificate.plant_id} · issued by {certificate.raw_record.issuer_id} · {formatDateTime(certificate.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyVerifyLink}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 px-4 text-sm font-medium text-recon-ink shadow-[inset_0_1px_0_#fff] transition-colors hover:border-recon-ink/40"
            >
              <Link2 className="h-4 w-4" /> Share
            </button>
            {canAct && (
              <>
                <button
                  type="button"
                  onClick={() => setTransferOpen((v) => !v)}
                  aria-expanded={transferOpen}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 px-4 text-sm font-medium text-recon-ink shadow-[inset_0_1px_0_#fff] transition-colors hover:border-recon-ink/40"
                >
                  <Send className="h-4 w-4" /> Transfer
                </button>
                <button
                  type="button"
                  onClick={() => (confirmRetire ? retireMutation.mutate() : setConfirmRetire(true))}
                  disabled={retireMutation.isPending}
                  className={
                    "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-colors disabled:opacity-60 " +
                    (confirmRetire ? "bg-risk hover:bg-risk-deep" : "bg-recon-forest hover:bg-[#1b4332]")
                  }
                >
                  <Lock className="h-4 w-4" />
                  {retireMutation.isPending ? "Retiring…" : confirmRetire ? "Confirm retire" : "Retire"}
                </button>
                {confirmRetire && !retireMutation.isPending && (
                  <button
                    type="button"
                    onClick={() => setConfirmRetire(false)}
                    className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-recon-ink-dim hover:text-recon-ink"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Reveal>

      {confirmRetire && !retireMutation.isPending && (
        <p role="status" className="glass glass-thin flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-recon-ink-soft">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
          Retiring marks this certificate as consumed on-chain. It can&apos;t be transferred or retired again afterwards.
        </p>
      )}

      {transferOpen && canAct && <TransferPanel tokenId={tokenId} onClose={() => setTransferOpen(false)} />}

      {retireMutation.isError && (
        <p role="alert" className="glass glass-risk flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-risk">
          <AlertTriangle className="h-4 w-4" />
          {retireMutation.error instanceof Error ? retireMutation.error.message : "Retiring failed."}
        </p>
      )}
      {retireMutation.isSuccess && (
        <p role="status" className="glass glass-verified flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-verified">
          <CheckCircle2 className="h-4 w-4" /> Retired on-chain.
        </p>
      )}

      {/* Key facts */}
      <Reveal y={10}>
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Plant", `${certificate.plant_id} · ${report.capacityMw} MW ${report.plantType}`],
            ["Energy claimed", formatMwh(certificate.energy_mwh)],
            ["Generation window", `${formatDateTime(report.windowStart.toISOString())} · ${report.windowHours.toFixed(1)} h`],
            ["Location", formatCoord(report.lat, report.lon)],
            ["Issuer", certificate.raw_record.issuer_id],
            ["Current owner", truncateAddress(certificate.owner_address)],
          ].map(([label, value]) => (
            <div key={label} className="glass glass-thin rounded-xl px-3.5 py-3">
              <dt className="label-caps text-recon-steel">{label}</dt>
              <dd
                className={
                  "mt-1 line-clamp-2 text-[13px] break-words " +
                  (label === "Energy claimed" && report.verdict === "violation" ? "font-semibold text-risk" : "text-recon-ink")
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      {/* Verdict */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <Panel className="flex h-full flex-col" cap={flagged ? "risk" : "verified"}>
            <div className="flex items-center justify-between gap-2">
              <span className="label-caps text-recon-steel">Risk assessment</span>
              <SignalBadge tone={toneForScore(pillars.composite)}>{severityLabel(pillars.composite)}</SignalBadge>
            </div>
            <p className={"font-display mt-4 text-[48px] leading-none font-bold tracking-tight sm:text-[56px] " + (flagged ? "text-risk" : "text-verified")}>
              {pillars.composite}
              <span className="ml-2 align-middle text-base font-medium text-recon-steel">/ 100</span>
            </p>
            <p className="mt-4 text-[15px] leading-6 font-semibold text-recon-ink">
              {flagged
                ? "Review this certificate before anyone relies on it."
                : pillars.composite >= 25
                  ? "Minor anomalies — worth a second look, but not flagged."
                  : "No meaningful fraud indicators."}
            </p>
            {certificate.explanation && <p className="mt-2 text-sm leading-6 text-recon-ink-dim">{certificate.explanation}</p>}

            <div className="mt-4 border-t border-recon-ink/[0.08] pt-4">
              <p className="label-caps mb-2 text-recon-steel">Reasons</p>
              {certificate.risk_reasons.length > 0 ? (
                <ul className="space-y-1.5">
                  {certificate.risk_reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-sm text-recon-ink">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk" />
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-verified">
                  <ClipboardCheck className="h-4 w-4" /> The model reported no risk indicators.
                </p>
              )}
            </div>

            <p className="mt-auto pt-4 text-xs leading-5 text-recon-steel">
              The overall score combines the three checks on the right and is never lower than the model&apos;s own score (
              {certificate.fraud_score}).
            </p>
          </Panel>
        </Reveal>
        <Reveal delay={0.06}>
          <SignalTriangle tokenId={certificate.token_id} pillars={pillars} report={report} />
        </Reveal>
      </div>

      <Reveal>
        <h2 className="mb-3 text-lg font-bold text-recon-ink">Evidence</h2>
        <EvidencePillars certificate={certificate} report={report} pillars={pillars} ownerShare={ownerShare} />
      </Reveal>

      {/* Physics */}
      <Reveal>
        <Panel>
          <PanelHeader
            icon={SunMedium}
            title="Claimed output vs. what the plant could produce"
            description={`Modelled for ${report.windowStart.toISOString().slice(0, 10)} (UTC) at the plant's coordinates. Modelled, not metered.`}
            actions={
              <SignalBadge tone={verdictTone}>
                {report.verdict === "violation" ? "Physically impossible" : report.verdict === "marginal" ? "Near the limit" : "Physically plausible"}
              </SignalBadge>
            }
          />
          <div className="grid-well rounded-xl border border-white/70 p-2">
            <EnvelopeChart report={report} height={280} compact />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <EnvelopeLegend report={report} />
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lon}#map=12/${report.lat}/${report.lon}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-recon-ink hover:text-gold"
              >
                <MapPin className="h-3.5 w-3.5" /> View on map
              </a>
              <Link href={`/physical?id=${certificate.token_id}`} className="flex items-center gap-1 text-xs font-semibold text-recon-ink hover:text-gold">
                <SunMedium className="h-3.5 w-3.5" /> Full physics check
              </Link>
            </div>
          </div>
        </Panel>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <OnChainProofPanel certificate={certificate} />
        </Reveal>
        <Reveal delay={0.06}>
          <LifecycleTimeline certificate={certificate} />
        </Reveal>
      </div>
    </div>
  );
}
