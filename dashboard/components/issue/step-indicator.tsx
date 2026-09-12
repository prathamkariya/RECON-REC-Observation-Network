import { cn } from "cn";

const STEPS = ["Generation data", "AI analysis", "Mint on Sepolia"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const state = stepNum < current ? "done" : stepNum === current ? "active" : "upcoming";
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                state === "done" && "border-gold bg-gold text-recon-gold-ink",
                state === "active" && "border-gold text-gold",
                state === "upcoming" && "border-border text-recon-ink-dim",
              )}
            >
              {stepNum}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                state === "upcoming" ? "text-recon-ink-dim" : "text-recon-ink",
              )}
            >
              {label}
            </span>
            {stepNum < STEPS.length && (
              <span className={cn("mx-1 h-px flex-1", state === "done" ? "bg-gold" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
