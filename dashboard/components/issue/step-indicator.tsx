import { cn } from "cn";

const STEPS = ["Generation data", "Risk analysis", "Mint certificate"];

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="glass glass-thin flex items-center gap-2 rounded-2xl px-4 py-3 sm:gap-4 sm:px-5">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const state = stepNum < current ? "done" : stepNum === current ? "active" : "upcoming";
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                "mono-micro flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-semibold",
                state === "done" && "border-gold bg-gold text-recon-gold-ink",
                state === "active" && "border-gold bg-white/80 text-gold shadow-[0_0_0_4px_rgba(60,100,80,0.12)]",
                state === "upcoming" && "border-recon-ink/15 bg-white/50 text-recon-ink-dim",
              )}
            >
              {stepNum}
            </span>
            <span
              className={cn(
                "hidden text-sm font-medium sm:inline",
                state === "upcoming" ? "text-recon-ink-dim" : "text-recon-ink",
              )}
            >
              {label}
            </span>
            {stepNum < STEPS.length && (
              <span className={cn("mx-1 h-0.5 flex-1 rounded-full", state === "done" ? "bg-gold" : "bg-recon-ink/10")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
