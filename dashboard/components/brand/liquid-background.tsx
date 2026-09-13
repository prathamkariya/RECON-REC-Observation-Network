/**
 * The ambient field every glass panel refracts. Three large, heavily blurred
 * color masses (Fidelity Green, sage, a faint dossier warmth) drift on long,
 * offset cycles so the glass above always has something soft moving behind
 * it. Fixed to the viewport, below everything, and inert to pointer events.
 *
 * Kept deliberately low-contrast: it's there to give the blur something to
 * bend, never to compete with data. Animation stops under reduced motion via
 * the global media query in globals.css.
 */
export function LiquidBackground({ variant = "app" }: { variant?: "app" | "hero" }) {
  const strong = variant === "hero";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f4f5f1]">
      <div
        className="absolute -top-[20%] -left-[10%] h-[70vmax] w-[70vmax] rounded-full blur-[90px] animate-drift-a will-change-transform"
        style={{
          background: `radial-gradient(circle at 40% 40%, rgba(84, 125, 104, ${strong ? 0.5 : 0.42}), rgba(84, 125, 104, 0) 62%)`,
        }}
      />
      <div
        className="absolute top-[10%] -right-[15%] h-[60vmax] w-[60vmax] rounded-full blur-[100px] animate-drift-b will-change-transform"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(165, 208, 184, ${strong ? 0.62 : 0.55}), rgba(165, 208, 184, 0) 60%)`,
        }}
      />
      <div
        className="absolute -bottom-[25%] left-[20%] h-[65vmax] w-[65vmax] rounded-full blur-[110px] animate-drift-c will-change-transform"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(214, 196, 160, ${strong ? 0.42 : 0.34}), rgba(214, 196, 160, 0) 60%)`,
        }}
      />
      {strong && (
        <div
          className="absolute top-[35%] left-[55%] h-[28vmax] w-[28vmax] rounded-full blur-[90px] animate-drift-b"
          style={{ background: "radial-gradient(circle, rgba(179, 38, 30, 0.12), rgba(179, 38, 30, 0) 65%)" }}
        />
      )}
      {/* Fine architectural grid, faded toward the edges. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(19,27,46,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(19,27,46,0.035) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 85%)",
        }}
      />
      {/* Paper grain so large glass areas don't band. */}
      <div
        className="absolute inset-0 opacity-[0.35] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.07 0 0 0 0 0.1 0 0 0 0 0.18 0 0 0 0.05 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
