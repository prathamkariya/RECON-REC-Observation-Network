import { cn } from "cn";
import { riskLevel } from "@/lib/types";

const STYLES = {
  low: "bg-verified/10 text-verified border-verified/30",
  medium: "bg-gold/10 text-gold border-gold/30",
  high: "bg-risk/10 text-risk border-risk/30",
};

const LABELS = { low: "Low risk", medium: "Medium risk", high: "High risk" };

export function RiskBadge({ score, className }: { score: number; className?: string }) {
  const level = riskLevel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[level],
        className,
      )}
    >
      {LABELS[level]} · {score}
    </span>
  );
}
