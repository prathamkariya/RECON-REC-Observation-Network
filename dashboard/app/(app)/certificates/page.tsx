"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileBadge2, FilePlus2, Lock, ShieldAlert, Zap } from "lucide-react";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { CertificatesTable } from "@/components/certificates/certificates-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/glass/panel";
import { ConsoleSkeleton, ErrorPanel, Shimmer } from "@/components/glass/states";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

function Archive() {
  const searchParams = useSearchParams();
  const { data: certificates, isLoading, isError } = useCertificates();

  if (isLoading) return <ConsoleSkeleton kpis={4} />;
  if (isError || !certificates) return <ErrorPanel title="Couldn't load certificates" />;

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD).length;
  const retired = certificates.filter((c) => c.status === "retired").length;
  const mwh = certificates.reduce((s, c) => s + c.energy_mwh, 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <PageHeader
          crumbs={["REC Market", "Certificate Archive"]}
          title="Every certificate on the registry."
          description="Search, filter and sort the full ledger. Open any row for its forensic dossier."
          actions={
            <Link
              href="/issue"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-recon-forest px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,42,32,0.7)] transition-colors hover:bg-[#1b4332]"
            >
              <FilePlus2 className="h-4 w-4" /> Issue certificate
            </Link>
          }
        />
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label="Certificates" value={certificates.length} icon={FileBadge2} footnote="On-chain" footnoteValue="Sepolia" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Energy certified" value={mwh} decimals={0} suffix="MWh" icon={Zap} accent="verified" footnote="Unique records" footnoteValue={`${certificates.length}`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Flagged" value={flagged} icon={ShieldAlert} accent={flagged ? "risk" : "neutral"} footnote="Score" footnoteValue={`≥ ${FRAUD_FLAG_THRESHOLD}`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Retired" value={retired} icon={Lock} footnote="Consumed" footnoteValue={`${certificates.length ? Math.round((retired / certificates.length) * 100) : 0}%`} />
        </StaggerItem>
      </Stagger>

      <Reveal>
        {/* Keyed on the query so a new top-bar search while already here resets the filter. */}
        <CertificatesTable key={searchParams.get("q") ?? ""} certificates={certificates} initialSearch={searchParams.get("q") ?? ""} />
      </Reveal>
    </div>
  );
}

export default function CertificatesPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense fallback={<Shimmer className="h-[480px] rounded-2xl" />}>
      <Archive />
    </Suspense>
  );
}
