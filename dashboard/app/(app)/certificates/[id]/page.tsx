"use client";

import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCertificate } from "@/lib/hooks/use-certificates";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { OnChainProofPanel } from "@/components/certificate/onchain-proof-panel";
import { LifecycleTimeline } from "@/components/certificate/lifecycle-timeline";
import { formatDateTime, formatMwh } from "@/lib/format";
import { api } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";
import { ApiError } from "@/lib/api-error";

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const tokenId = Number(params.id);
  const { data: certificate, isLoading, isError, error } = useCertificate(tokenId);
  const queryClient = useQueryClient();

  const retireMutation = useMutation({
    mutationFn: () => api.retireCertificate(tokenId),
    onSuccess: () => {
      logActivity({ type: "retired", tokenId, message: `Certificate #${tokenId} retired` });
      queryClient.invalidateQueries({ queryKey: ["certificate", tokenId] });
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !certificate) {
    return (
      <div className="glass glass-risk mx-auto max-w-2xl p-6 text-center text-sm text-recon-ink">
        {error instanceof ApiError && error.isNotFound
          ? `No certificate found for token #${params.id}.`
          : "Couldn't load this certificate."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-wide text-recon-ink-dim">Certificate</p>
          <h1 className="font-display text-3xl font-semibold">
            #{certificate.token_id} <span className="text-recon-ink-dim">·</span> {certificate.plant_id}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <RiskBadge score={certificate.fraud_score} />
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs capitalize text-recon-ink-dim">
              {certificate.status}
            </span>
          </div>
        </div>

        {certificate.status === "issued" && (
          <Button
            variant="outline"
            onClick={() => retireMutation.mutate()}
            disabled={retireMutation.isPending}
          >
            {retireMutation.isPending ? "Retiring…" : "Retire certificate"}
          </Button>
        )}
      </div>

      {retireMutation.isError && (
        <p className="flex items-center gap-2 text-sm text-risk">
          <AlertTriangle className="h-4 w-4" />
          {retireMutation.error instanceof Error ? retireMutation.error.message : "Retiring failed."}
        </p>
      )}
      {retireMutation.isSuccess && (
        <p className="flex items-center gap-2 text-sm text-verified">
          <CheckCircle2 className="h-4 w-4" /> Retired on-chain.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass glass-thin space-y-4 p-6">
          <p className="text-xs tracking-wide text-recon-ink-dim">Off-chain — plant &amp; AI reasoning</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-recon-ink-dim">Energy</dt>
            <dd>{formatMwh(certificate.energy_mwh)}</dd>
            <dt className="text-recon-ink-dim">Generation time</dt>
            <dd>{formatDateTime(certificate.generation_timestamp)}</dd>
            <dt className="text-recon-ink-dim">Source</dt>
            <dd className="capitalize">{certificate.raw_record.plant.type}</dd>
            <dt className="text-recon-ink-dim">Location</dt>
            <dd>
              {certificate.raw_record.plant.lat.toFixed(2)}, {certificate.raw_record.plant.lon.toFixed(2)}
            </dd>
            <dt className="text-recon-ink-dim">Issuer</dt>
            <dd>{certificate.raw_record.issuer_id}</dd>
          </dl>

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs tracking-wide text-recon-ink-dim">Fraud reasoning</p>
            {certificate.risk_reasons.length === 0 ? (
              <p className="text-sm text-verified">No fraud indicators found.</p>
            ) : (
              <ul className="space-y-1.5">
                {certificate.risk_reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-recon-ink">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk" />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-recon-ink-dim">{certificate.explanation}</p>
          </div>
        </div>

        <OnChainProofPanel certificate={certificate} />
      </div>

      <LifecycleTimeline certificate={certificate} />
    </div>
  );
}
