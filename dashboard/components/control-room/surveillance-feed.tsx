"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge, severityLabel } from "@/components/glass/signal-badge";
import { useLocalActivityLog } from "@/lib/activity-log";
import { certificateSerial, formatMwh, formatRelative } from "@/lib/format";
import type { CertificateListItem } from "@/lib/types";

type Alert = {
  id: string;
  time: string;
  tokenId?: number;
  plantId?: string;
  score?: number;
  detail: string;
};

/** Certificates that need a look (score ≥ 25), highest risk first, plus duplicate mints rejected in this browser. */
export function SurveillanceFeed({ certificates }: { certificates: CertificateListItem[] }) {
  const local = useLocalActivityLog();

  const alerts: Alert[] = [
    ...local
      .filter((e) => e.type === "duplicate_rejected")
      .map<Alert>((e) => ({ id: e.id, time: e.timestamp, plantId: e.plantId, detail: e.message })),
    ...certificates
      .filter((c) => c.fraud_score >= 25)
      .map<Alert>((c) => ({
        id: `cert-${c.token_id}`,
        time: c.created_at,
        tokenId: c.token_id,
        plantId: c.plant_id,
        score: c.fraud_score,
        detail: `${formatMwh(c.energy_mwh)} claimed`,
      })),
  ]
    .sort((a, b) => (b.score ?? 100) - (a.score ?? 100) || (a.time < b.time ? 1 : -1))
    .slice(0, 6);

  return (
    <Panel className="flex h-full flex-col">
      <PanelHeader icon={ShieldAlert} title="Needs review" description="Highest-risk certificates first." />

      {alerts.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-recon-ink/15 p-6 text-center text-sm text-recon-ink-dim">
          Nothing to review. Every certificate scored below 25.
        </p>
      ) : (
        <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2" data-lenis-prevent>
          {alerts.map((alert, i) => {
            const body = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="mono-data font-semibold text-recon-ink">
                    {alert.tokenId !== undefined ? certificateSerial(alert.tokenId) : "Duplicate rejected"}
                  </span>
                  {alert.score !== undefined ? (
                    <SignalBadge tone={alert.score >= 75 ? "solid-risk" : alert.score >= 50 ? "risk" : "warn"}>
                      {alert.score} · {severityLabel(alert.score)}
                    </SignalBadge>
                  ) : (
                    <SignalBadge tone="warn">Blocked</SignalBadge>
                  )}
                </div>
                <p className="mt-1 flex items-center justify-between gap-2 text-[13px] text-recon-ink-dim">
                  <span className="truncate">
                    {alert.plantId} · {alert.detail}
                  </span>
                  <span className="mono-micro shrink-0 text-recon-steel">{formatRelative(alert.time)}</span>
                </p>
              </>
            );
            return (
              <motion.li
                key={alert.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {alert.tokenId !== undefined ? (
                  <Link
                    href={`/certificates/${alert.tokenId}`}
                    className="group relative block rounded-xl border border-white/80 bg-white/55 p-3 pr-8 shadow-[inset_0_1px_0_#fff] transition-colors hover:bg-white/80"
                  >
                    {body}
                    <ChevronRight className="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-recon-steel transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/80 bg-white/55 p-3 shadow-[inset_0_1px_0_#fff]">{body}</div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}

      <Link
        href="/fraud"
        className="mt-4 flex h-10 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-sm font-medium text-gold transition-colors hover:bg-gold/15"
      >
        Open fraud review
      </Link>
    </Panel>
  );
}
