"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const FIG_W = 84;
const FIG_H = 118;
const DODGE_RADIUS = 130;
const EDGE = 10;
const TOP_MIN = 40;
/** Space reserved at the bottom of the zone for the speech bubble. */
const BUBBLE_SPACE = 64;

const QUIPS = [
  "Can't catch me!",
  "Nice try!",
  "Too slow!",
  "Spidey-sense tingling…",
  "Nope!",
  "With great power…",
  "Almost! (not really)",
];

/**
 * A Spider-Man hanging from his web inside a text-free zone. Whenever the
 * pointer gets close he swings away — clamped to the zone so he never drifts
 * over the page copy, and warping to the far side when cornered.
 */
export function HangingSpidey({ className }: { className?: string }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const lastDodge = useRef(0);
  const [quip, setQuip] = useState<{ id: number; text: string } | null>(null);

  // Targets: where the web is anchored and how far down he hangs.
  const anchorX = useMotionValue(0);
  const hangY = useMotionValue(0);
  const webX = useSpring(anchorX, { stiffness: 900, damping: 40 });
  const bodyX = useSpring(anchorX, { stiffness: 120, damping: 11, mass: 0.8 });
  const bodyY = useSpring(hangY, { stiffness: 160, damping: 14 });

  const figLeft = useTransform(bodyX, (v) => v - FIG_W / 2);
  const rotate = useTransform([webX, bodyX, bodyY], ([ax, bx, by]: number[]) => (-Math.atan2(bx - ax, Math.max(by, 1)) * 180) / Math.PI);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    const clampX = (v: number) => Math.min(Math.max(v, FIG_W / 2 + EDGE), size.current.w - FIG_W / 2 - EDGE);
    const clampY = (v: number) => Math.min(Math.max(v, TOP_MIN), Math.max(TOP_MIN, size.current.h - FIG_H - BUBBLE_SPACE));

    let initialised = false;
    const ro = new ResizeObserver(([entry]) => {
      size.current = { w: entry.contentRect.width, h: entry.contentRect.height };
      if (!initialised) {
        initialised = true;
        const x = size.current.w / 2;
        const y = clampY(size.current.h * 0.3);
        anchorX.jump(x);
        hangY.jump(y);
        webX.jump(x);
        bodyX.jump(x);
        bodyY.jump(y);
      } else {
        anchorX.set(clampX(anchorX.get()));
        hangY.set(clampY(hangY.get()));
      }
    });
    ro.observe(zone);

    const onPointer = (e: PointerEvent) => {
      const { w, h } = size.current;
      if (!w) return;
      const rect = zone.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px < -DODGE_RADIUS || py < -DODGE_RADIUS || px > w + DODGE_RADIUS || py > h + DODGE_RADIUS) return;

      const cx = bodyX.get();
      const cy = bodyY.get() + FIG_H / 2;
      const dist = Math.hypot(px - cx, py - cy);
      const now = performance.now();
      if (dist > DODGE_RADIUS || now - lastDodge.current < 120) return;

      // Already heading somewhere safe? Let the swing finish.
      const tx = anchorX.get();
      const ty = hangY.get() + FIG_H / 2;
      if (Math.hypot(px - tx, py - ty) > DODGE_RADIUS * 1.3 && dist > DODGE_RADIUS * 0.5) return;

      lastDodge.current = now;
      const len = dist || 1;
      let nx = clampX(cx + ((cx - px) / len) * 190);
      let ny = clampY(hangY.get() + ((cy - py) / len) * 110);

      // Cornered: fire a new web on the opposite side of the zone.
      if (Math.hypot(px - nx, py - (ny + FIG_H / 2)) < DODGE_RADIUS) {
        nx = clampX(px < w / 2 ? w - FIG_W / 2 - EDGE - Math.random() * 40 : FIG_W / 2 + EDGE + Math.random() * 40);
        ny = clampY(TOP_MIN + Math.random() * (h - FIG_H - BUBBLE_SPACE - TOP_MIN));
      }

      anchorX.set(nx);
      hangY.set(ny);
      setQuip((q) => {
        if (q && now - q.id < 900) return q;
        return { id: now, text: QUIPS[Math.floor(Math.random() * QUIPS.length)] };
      });
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [anchorX, hangY, webX, bodyX, bodyY]);

  useEffect(() => {
    if (!quip) return;
    const t = window.setTimeout(() => setQuip(null), 1600);
    return () => window.clearTimeout(t);
  }, [quip]);

  return (
    <div ref={zoneRef} aria-hidden className={`relative overflow-hidden select-none ${className ?? ""}`}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <motion.line x1={webX} y1={0} x2={bodyX} y2={bodyY} stroke="rgba(19,27,46,0.35)" strokeWidth={1.5} />
      </svg>

      <motion.div
        className="pointer-events-none absolute top-0 left-0"
        style={{ x: figLeft, y: bodyY, width: FIG_W, height: FIG_H, rotate, transformOrigin: "50% 0%" }}
      >
        <SpideyFigure />
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <AnimatePresence mode="wait">
          {quip ? (
            <motion.span
              key={quip.id}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-full border border-white/80 bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-risk shadow-[0_8px_20px_-10px_rgba(19,27,46,0.35)]"
            >
              {quip.text}
            </motion.span>
          ) : (
            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mono-micro text-recon-steel">
              psst — try to catch him
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Upside-down Spider-Man; the web attaches between his feet at the top. */
function SpideyFigure() {
  const red = "#d62828";
  const redDark = "#9b1b1b";
  const blue = "#1d4ed8";
  const line = "rgba(80,10,10,0.55)";
  return (
    <svg viewBox="0 0 84 118" width={FIG_W} height={FIG_H} className="drop-shadow-[0_10px_14px_rgba(19,27,46,0.25)]">
      {/* legs, feet up */}
      <path d="M36 2 C33 14 33 30 35 44 L42 44 L41 6 Z" fill={blue} />
      <path d="M48 2 C51 14 51 30 49 44 L42 44 L43 6 Z" fill={blue} />
      <path d="M35 0 h8 v12 h-9 Z" fill={red} />
      <path d="M41 0 h9 v12 h-8 Z" fill={red} />
      {/* torso */}
      <path d="M28 42 h28 c3 0 4 3 4 6 l-2 26 c0 4 -3 6 -7 6 h-18 c-4 0 -7 -2 -7 -6 l-2 -26 c0 -3 1 -6 4 -6 Z" fill={red} />
      <path d="M26 50 l4 26 c-2 -1 -3 -2 -4 -4 Z M58 50 l-4 26 c2 -1 3 -2 4 -4 Z" fill={blue} />
      <rect x="28" y="42" width="28" height="4" rx="2" fill={redDark} />
      {/* spider emblem */}
      <g stroke="#131b2e" strokeWidth="1.2" strokeLinecap="round">
        <ellipse cx="42" cy="60" rx="2.6" ry="4.2" fill="#131b2e" />
        <path d="M40 57 l-5 -4 M44 57 l5 -4 M40 60 h-6 M44 60 h6 M40 63 l-5 4 M44 63 l5 4" fill="none" />
      </g>
      {/* arms dangling past the head */}
      <path d="M26 72 C20 84 17 96 18 106" stroke={red} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M58 72 C64 84 67 96 66 106" stroke={red} strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="108" r="4.5" fill={red} />
      <circle cx="66" cy="108" r="4.5" fill={red} />
      {/* head */}
      <ellipse cx="42" cy="96" rx="16" ry="19" fill={red} />
      <g stroke={line} strokeWidth="0.8" fill="none">
        <path d="M42 77 V115" />
        <path d="M26.5 92 Q42 88 57.5 92" />
        <path d="M28 102 Q42 98 56 102" />
        <path d="M32 110 Q42 107 52 110" />
        <path d="M30 83 Q42 80 54 83" />
        <path d="M34 78 Q30 96 34 114 M50 78 Q54 96 50 114" />
      </g>
      {/* eyes (upside down, near the bottom of the head) */}
      <path d="M29 100 C31 93 37 93 40 99 C37 106 31 107 29 100 Z" fill="#fff" stroke="#131b2e" strokeWidth="2" />
      <path d="M55 100 C53 93 47 93 44 99 C47 106 53 107 55 100 Z" fill="#fff" stroke="#131b2e" strokeWidth="2" />
    </svg>
  );
}
