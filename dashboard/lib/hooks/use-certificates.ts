"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCertificates() {
  return useQuery({
    queryKey: ["certificates"],
    queryFn: api.listCertificates,
    refetchInterval: 30_000,
  });
}

export function useCertificate(tokenId: number) {
  return useQuery({
    queryKey: ["certificate", tokenId],
    queryFn: () => api.getCertificate(tokenId),
    enabled: Number.isFinite(tokenId),
  });
}

/** Backend health and chain readiness, refreshed every 30s. */
export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: api.getStatus,
    refetchInterval: 30_000,
    retry: false,
  });
}
