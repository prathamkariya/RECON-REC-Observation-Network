import { cn } from "cn";

/** The REC Intelligence mark from the Stitch brand set: a shield framing a
 *  certificate, with a verification node and an energy check-stroke. */
export function ReconMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("h-8 w-8 shrink-0", className)}>
      <path
        d="M24 4L7 11V22C7 33.1 14.3 43.3 24 46C33.7 43.3 41 33.1 41 22V11L24 4Z"
        fill="#1b4332"
        stroke="#2d6a4f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="15" y="14" width="18" height="20" rx="2" fill="#0f291e" stroke="#52b788" strokeWidth="1.5" />
      <line x1="19" y1="19" x2="29" y2="19" stroke="#b7e4c7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="23" x2="27" y2="23" stroke="#b7e4c7" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19" y1="27" x2="25" y2="27" stroke="#74c69d" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="28" cy="27" r="2.5" fill="#40916c" stroke="#d8f3dc" strokeWidth="1" />
      <path d="M22 36L26 40L36 30" stroke="#52b788" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReconWordmark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <ReconMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[13px] font-bold tracking-[0.02em] text-recon-ink">
          REC <span className="font-semibold tracking-[0.12em] text-gold">INTELLIGENCE</span>
        </span>
        {subtitle && <span className="mono-micro mt-1 hidden text-recon-steel min-[420px]:block">GRID FORENSICS · RECON</span>}
      </span>
    </span>
  );
}
