"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CertificateListItem } from "@/lib/types";

function groupByDay(certs: CertificateListItem[]) {
  const counts = new Map<string, number>();
  for (const cert of certs) {
    const day = new Date(cert.created_at).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({
      date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date)),
      count,
    }));
}

export function IssuanceChart({ certificates }: { certificates: CertificateListItem[] }) {
  const data = groupByDay(certificates);

  if (data.length === 0) {
    return (
      <div className="glass glass-thin flex h-64 items-center justify-center p-5">
        <p className="text-sm text-recon-ink-dim">No certificates issued yet.</p>
      </div>
    );
  }

  return (
    <div className="glass glass-thin h-64 p-5">
      <p className="mb-2 text-xs tracking-wide text-recon-ink-dim">Certificates issued</p>
      <ResponsiveContainer width="100%" height="88%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="issuanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8A33D" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#E8A33D" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(242,239,232,0.08)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#A6ADBB", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#A6ADBB", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#161D2B",
              border: "1px solid rgba(242,239,232,0.12)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F2EFE8" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#E8A33D"
            strokeWidth={2}
            fill="url(#issuanceFill)"
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
