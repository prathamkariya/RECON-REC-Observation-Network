"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { riskLevel, type CertificateListItem } from "@/lib/types";

const COLORS = { Low: "#4FD1C5", Medium: "#E8A33D", High: "#E85D4B" };

export function RiskDistributionChart({ certificates }: { certificates: CertificateListItem[] }) {
  const counts = { Low: 0, Medium: 0, High: 0 };
  for (const c of certificates) {
    const level = riskLevel(c.fraud_score);
    counts[level === "low" ? "Low" : level === "medium" ? "Medium" : "High"] += 1;
  }
  const data = (["Low", "Medium", "High"] as const).map((level) => ({ level, count: counts[level] }));

  return (
    <div className="glass glass-thin h-72 p-5">
      <p className="mb-2 text-xs tracking-wide text-recon-ink-dim">Risk distribution</p>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(242,239,232,0.08)" vertical={false} />
          <XAxis dataKey="level" tick={{ fill: "#A6ADBB", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#A6ADBB", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(242,239,232,0.04)" }}
            contentStyle={{
              background: "#161D2B",
              border: "1px solid rgba(242,239,232,0.12)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#F2EFE8" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={700}>
            {data.map((entry) => (
              <Cell key={entry.level} fill={COLORS[entry.level]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
