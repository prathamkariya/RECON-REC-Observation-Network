"use client";

import { useCertificates } from "@/lib/hooks/use-certificates";
import { Skeleton } from "@/components/ui/skeleton";
import { CertificatesTable } from "@/components/certificates/certificates-table";

export default function CertificatesPage() {
  const { data: certificates, isLoading, isError } = useCertificates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Certificates</h1>
        <p className="text-sm text-recon-ink-dim">Every certificate issued on this registry.</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="glass glass-risk p-6 text-sm text-recon-ink">
          Couldn&apos;t load certificates. Check that the backend is running and reachable.
        </div>
      )}

      {certificates && <CertificatesTable certificates={certificates} />}
    </div>
  );
}
