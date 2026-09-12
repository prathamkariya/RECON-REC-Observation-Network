"use client";

import { motion } from "framer-motion";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { StatCard } from "@/components/dashboard/stat-card";
import { IssuanceChart } from "@/components/dashboard/issuance-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { RecentCertificates } from "@/components/dashboard/recent-certificates";
import { Skeleton } from "@/components/ui/skeleton";
import { FRAUD_FLAG_THRESHOLD } from "@/lib/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function DashboardPage() {
  const { data: certificates, isLoading, isError } = useCertificates();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
        <Skeleton className="col-span-full h-64 rounded-xl" />
      </div>
    );
  }

  if (isError || !certificates) {
    return (
      <div className="glass glass-risk p-6 text-sm text-recon-ink">
        Couldn&apos;t load dashboard data. Check that the backend is running and reachable.
      </div>
    );
  }

  const flagged = certificates.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD);
  const verified = certificates.length - flagged.length;
  const totalEnergy = certificates.reduce((sum, c) => sum + c.energy_mwh, 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-recon-ink-dim">Real-time view of every certificate issued on this registry.</p>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total certificates" value={certificates.length} />
        <StatCard label="Verified clean" value={verified} accent="verified" />
        <StatCard label="Fraud flagged" value={flagged.length} accent={flagged.length > 0 ? "risk" : "neutral"} />
        <StatCard label="Energy certified" value={totalEnergy} suffix="MWh" accent="gold" decimals={1} />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IssuanceChart certificates={certificates} />
        </div>
        <ActivityFeed certificates={certificates} />
      </motion.div>

      <motion.div variants={item}>
        <RecentCertificates certificates={certificates} />
      </motion.div>
    </motion.div>
  );
}
