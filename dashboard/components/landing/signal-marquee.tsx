const SIGNALS = [
  "Solar position · NOAA SPA",
  "Clear-sky irradiance envelopes",
  "Nameplate capacity ceilings",
  "Isolation-forest anomaly scores",
  "Benford digit conformance",
  "Custody concentration graphs",
  "On-chain uniqueness proofs",
  "ERC-721 certificate registry",
];

/** Endless glass ticker of the signals every certificate is checked against. */
export function SignalMarquee() {
  const row = [...SIGNALS, ...SIGNALS];
  return (
    <section aria-label="Signals checked on every certificate" className="relative px-3 py-4 sm:px-4">
      <div className="glass glass-thin mx-auto max-w-7xl overflow-hidden rounded-2xl py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <ul className="flex w-max animate-marquee items-center gap-10 pr-10 hover:[animation-play-state:paused]">
          {row.map((signal, i) => (
            <li key={`${signal}-${i}`} aria-hidden={i >= SIGNALS.length} className="flex items-center gap-10 whitespace-nowrap">
              <span className="mono-data text-recon-ink-soft">{signal}</span>
              <span className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gold/50" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
