"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import type { CertificateListItem } from "@/lib/types";
import type { ActivityEvent } from "@/lib/activity-log";
import { useLocalActivityLog } from "@/lib/activity-log";
import { formatRelative } from "@/lib/format";
import { cn } from "cn";

function certsToEvents(certs: CertificateListItem[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const cert of certs) {
    events.push({
      id: `mint-${cert.token_id}`,
      type: "minted",
      tokenId: cert.token_id,
      plantId: cert.plant_id,
      message: `Certificate #${cert.token_id} minted for ${cert.plant_id}`,
      timestamp: cert.created_at,
    });
    if (cert.status === "retired") {
      events.push({
        id: `retire-${cert.token_id}`,
        type: "retired",
        tokenId: cert.token_id,
        plantId: cert.plant_id,
        message: `Certificate #${cert.token_id} retired`,
        timestamp: cert.created_at,
      });
    }
  }
  return events;
}

const ICONS: Record<ActivityEvent["type"], typeof CheckCircle2> = {
  minted: CheckCircle2,
  retired: ShieldAlert,
  duplicate_rejected: XCircle,
};

const ICON_TONE: Record<ActivityEvent["type"], string> = {
  minted: "text-verified",
  retired: "text-recon-ink-dim",
  duplicate_rejected: "text-risk",
};

export function ActivityFeed({ certificates }: { certificates: CertificateListItem[] }) {
  const localEvents = useLocalActivityLog();
  const events = [...localEvents, ...certsToEvents(certificates)]
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="glass glass-thin p-5">
      <p className="mb-3 text-xs tracking-wide text-recon-ink-dim">Activity</p>
      {events.length === 0 ? (
        <p className="text-sm text-recon-ink-dim">Nothing yet — issue your first certificate to see activity here.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event, i) => {
            const Icon = ICONS[event.type];
            return (
              <motion.li
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-start gap-3"
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_TONE[event.type])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-recon-ink">{event.message}</p>
                  <p className="text-xs text-recon-ink-dim">{formatRelative(event.timestamp)}</p>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
