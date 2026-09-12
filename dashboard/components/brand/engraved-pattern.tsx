// A fine guilloché-style line pattern — the engraved line-work found on
// currency and stock certificates, used here as the one recurring texture
// that ties "certification" to the visual language. Pure SVG, no assets.
export function EngravedPattern({ className, tone = "gold" }: { className?: string; tone?: "gold" | "verified" }) {
  const stroke = tone === "gold" ? "#E8A33D" : "#4FD1C5";
  const rings = Array.from({ length: 14 });

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id={`fade-${tone}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.9" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </radialGradient>
        <mask id={`mask-${tone}`}>
          <rect width="400" height="400" fill={`url(#fade-${tone})`} />
        </mask>
      </defs>
      <g mask={`url(#mask-${tone})`} fill="none" stroke={stroke} strokeWidth="0.6">
        {rings.map((_, i) => {
          const r = 20 + i * 14;
          return (
            <path
              key={i}
              d={`M ${200 - r} 200 A ${r} ${r * 0.94} 0 1 0 ${200 + r} 200 A ${r} ${r * 0.94} 0 1 0 ${200 - r} 200`}
              transform={`rotate(${i * 4.5} 200 200)`}
            />
          );
        })}
      </g>
    </svg>
  );
}
