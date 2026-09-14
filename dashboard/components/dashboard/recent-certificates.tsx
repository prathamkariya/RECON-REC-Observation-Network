"use client";

import Link from "next/link";
import { ArrowUpRight, FileBadge2 } from "lucide-react";
import type { CertificateListItem } from "@/lib/types";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge } from "@/components/glass/signal-badge";
import { formatMwh, truncateAddress } from "@/lib/format";

/** Forensic data table of the latest certificates (Stitch evidence table). */
export function RecentCertificates({ certificates }: { certificates: CertificateListItem[] }) {
  const recent = [...certificates].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 6);

  return (
    <Panel>
      <PanelHeader
        icon={FileBadge2}
        eyebrow="Registry ledger"
        title="Latest certificates"
        actions={
          <Link href="/certificates" className="flex items-center gap-1 text-xs font-semibold text-recon-ink hover:text-gold">
            View archive <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {recent.length === 0 ? (
        <p className="rounded-xl border border-dashed border-recon-ink/15 p-6 text-center text-sm text-recon-ink-dim">No certificates yet.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:-mx-6" data-lenis-prevent>
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-y border-recon-ink/[0.07] bg-white/40">
                {["Serial", "Plant", "Energy", "Holder", "Issued (UTC)", "Status", "Risk"].map((h, i) => (
                  <th key={h} className={"label-caps px-5 py-2.5 text-recon-steel sm:px-6 " + (i === 2 ? "text-right" : "")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((cert) => (
                <tr key={cert.token_id} className="group h-11 border-b border-recon-ink/[0.06] transition-colors last:border-0 hover:bg-white/50">
                  <td className="px-5 sm:px-6">
                    <Link href={`/certificates/${cert.token_id}`} className="mono-data font-semibold text-recon-ink group-hover:text-gold">
                      REC-{String(cert.token_id).padStart(5, "0")}
                    </Link>
                  </td>
                  <td className="px-5 text-[13px] text-recon-ink-soft sm:px-6">{cert.plant_id}</td>
                  <td className="mono-data px-5 text-right text-recon-ink sm:px-6">{formatMwh(cert.energy_mwh)}</td>
                  <td className="mono-micro px-5 text-recon-steel sm:px-6">{truncateAddress(cert.owner_address)}</td>
                  <td className="mono-micro px-5 text-recon-steel sm:px-6">{new Date(cert.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="px-5 sm:px-6">
                    <SignalBadge tone={cert.status === "retired" ? "ink" : "neutral"}>{cert.status}</SignalBadge>
                  </td>
                  <td className="px-5 sm:px-6">
                    <RiskBadge score={cert.fraud_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
