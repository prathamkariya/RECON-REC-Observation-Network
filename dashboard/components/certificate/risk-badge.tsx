import { SignalBadge, severityLabel, toneForScore } from "@/components/glass/signal-badge";

export function RiskBadge({ score, className }: { score: number; className?: string }) {
  return (
    <SignalBadge tone={toneForScore(score)} className={className}>
      {severityLabel(score)} · {score}
    </SignalBadge>
  );
}
