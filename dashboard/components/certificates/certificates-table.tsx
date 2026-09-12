"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RiskBadge } from "@/components/certificate/risk-badge";
import { formatDateTime, formatMwh, truncateAddress } from "@/lib/format";
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
  { key: "created_at", label: "Issued", className: "text-right" },
];

export function CertificatesTable({ certificates }: { certificates: CertificateListItem[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = certificates.filter((c) => {
      if (term && !c.plant_id.toLowerCase().includes(term) && !String(c.token_id).includes(term)) {
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by plant or token ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>{(v: StatusFilter) => STATUS_LABELS[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>{(v: RiskFilter) => RISK_LABELS[v]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="low">Low risk</SelectItem>
            <SelectItem value="medium">Medium risk</SelectItem>
            <SelectItem value="high">High risk</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-recon-ink-dim sm:ml-auto">
          {filtered.length} of {certificates.length}
        </p>
      </div>

      <div className="glass glass-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-recon-ink-dim">
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn("px-4 py-3 font-normal", col.className)}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 hover:text-recon-ink",
                      col.className === "text-right" && "flex-row-reverse",
                    )}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-recon-ink-dim">
                  No certificates match those filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.token_id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <Link href={`/certificates/${c.token_id}`} className="block">
                      <p className="font-medium text-recon-ink">
                        #{c.token_id} · {c.plant_id}
                      </p>
                      <p className="text-xs text-recon-ink-dim">{truncateAddress(c.owner_address)}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMwh(c.energy_mwh)}</td>
                  <td className="px-4 py-3 text-right">
                    <RiskBadge score={c.fraud_score} />
                  </td>
                  <td className="px-4 py-3 text-right text-recon-ink-dim">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-3 text-right capitalize text-recon-ink-dim">{c.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
