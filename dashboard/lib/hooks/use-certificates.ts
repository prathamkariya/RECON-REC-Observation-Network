"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCertificates() {
  return useQuery({
    queryKey: ["certificates"],
    queryFn: api.listCertificates,
  });
}

export function useCertificate(tokenId: number) {
  return useQuery({
    queryKey: ["certificate", tokenId],
    queryFn: () => api.getCertificate(tokenId),
    enabled: Number.isFinite(tokenId),
  });
}
