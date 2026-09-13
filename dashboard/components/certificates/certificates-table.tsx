"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { SignalBadge } from "@/components/glass/signal-badge";
import { formatMwh, truncateAddress } from "@/lib/format";
import { riskLevel, type CertificateListItem } from "@/lib/types";
import { cn } from "cn";

type SortKey = "token_id" | "energy_mwh" | "fraud_score" | "created_at";
type StatusFilter = "all" | "issued" | "retired";
type RiskFilter = "all" | "low" | "medium" | "high";

const STATUS_LABELS: Record<StatusFilter, string> = { all: "All statuses", issued: "Issued", retired: "Retired" };
const RISK_LABELS: Record<RiskFilter, string> = {
  all: "All risk levels",
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "token_id", label: "Certificate" },
  { key: "energy_mwh", label: "Energy", className: "text-right" },
  { key: "fraud_score", label: "Risk", className: "text-right" },
  { key: "created_at", label: "Issued (UTC)", className: "text-right" },
];

export function CertificatesTable({ certificates, initialSearch = "" }: { certificates: CertificateListItem[]; initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^rec-?0*/, "");
    let rows = certificates.filter((c) => {
      if (term && !c.plant_id.toLowerCase().includes(term) && !String(c.token_id).includes(term) && !c.owner_address.toLowerCase().includes(term)) {
        return false;
      }
      if (status !== "all" && c.status !== status) return false;
      if (risk !== "all" && riskLevel(c.fraud_score) !== risk) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "created_at") return a.created_at < b.created_at ? -dir : dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });

    return rows;
  }, [certificates, search, status, risk, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="glass glass-medium overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-3 border-b border-recon-ink/[0.07] p-4 sm:flex-row sm:items-center sm:p-5">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-recon-ink/10 bg-white/65 px-3 shadow-[inset_0_1px_0_#fff] focus-within:border-gold/50 focus-within:ring-2 focus-within:ring-gold/15 sm:max-w-sm">
          <Search className="h-4 w-4 text-recon-steel" />
          <span className="sr-only">Filter certificates</span>
          <input
            placeholder="Filter by serial, plant or wallet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mono-data min-w-0 flex-1 bg-transparent text-recon-ink outline-none placeholder:font-sans placeholder:text-[13px] placeholder:text-recon-steel"
          />
        </label>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-white/65 sm:w-40">
            <SelectValue>{(v: StatusFilter) => STATUS_LABELS[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-white/65 sm:w-40">
            <SelectValue>{(v: RiskFilter) => RISK_LABELS[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="low">Low risk</SelectItem>
            <SelectItem value="medium">Medium risk</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
          </SelectContent>
        </Select>
        <p className="mono-micro text-recon-steel sm:ml-auto">
          {filtered.length} / {certificates.length} RECORDS
        </p>
      </div>

      <div className="overflow-x-auto" data-lenis-prevent>
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-recon-ink/[0.07] bg-white/40">
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn("px-5 py-3", col.className)} aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "label-caps inline-flex items-center gap-1 text-recon-steel transition-colors hover:text-recon-ink",
                      col.className === "text-right" && "flex-row-reverse",
                      sortKey === col.key && "text-recon-ink",
                    )}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="label-caps px-5 py-3 text-right text-recon-steel">Status</th>
              <th className="w-10 px-3 py-3" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-sm text-recon-ink-dim">
                  No certificates match those filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.token_id}
                  className={cn(
                    "group h-14 border-b border-recon-ink/[0.05] transition-colors last:border-0 hover:bg-white/55",
                    c.fraud_score >= 50 && "bg-risk/[0.025]",
                  )}
                >
                  <td className="px-5">
                    <Link href={`/certificates/${c.token_id}`} className="block">
                      <span className="flex items-center gap-2">
                        {c.fraud_score >= 50 && <span className="h-1.5 w-1.5 rounded-full bg-risk" aria-hidden />}
                        <span className="mono-data font-semibold text-recon-ink group-hover:text-gold">REC-{String(c.token_id).padStart(5, "0")}</span>
                        <span className="text-[13px] text-recon-ink-soft">{c.plant_id}</span>
                      </span>
                      <span className="mono-micro mt-0.5 block text-recon-steel">{truncateAddress(c.owner_address)}</span>
                    </Link>
                  </td>
                  <td className="mono-data px-5 text-right text-recon-ink">{formatMwh(c.energy_mwh)}</td>
                  <td className="px-5 text-right">
                    <RiskBadge score={c.fraud_score} />
                  </td>
                  <td className="mono-micro px-5 text-right text-recon-steel">{new Date(c.created_at).toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td className="px-5 text-right">
                    <SignalBadge tone={c.status === "retired" ? "ink" : "neutral"}>{c.status}</SignalBadge>
                  </td>
                  <td className="px-3 text-right">
                    <Link href={`/certificates/${c.token_id}`} aria-label={`Open REC-${c.token_id}`} className="inline-flex text-recon-titanium group-hover:text-gold">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
