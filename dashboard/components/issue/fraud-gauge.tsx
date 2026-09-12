"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { riskLevel } from "@/lib/types";

const RADIUS = 80;
const ARC_LENGTH = Math.PI * RADIUS; // semicircle
const COLORS = { low: "#4FD1C5", medium: "#E8A33D", high: "#E85D4B" };

/** A semicircle gauge that fills to a real fraud score once it arrives —
 * never animates before the API has actually returned a value. */
export function FraudGauge({ score }: { score: number }) {
  const [display, setDisplay] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const level = riskLevel(score);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(score);
      return;
    }
    const controls = animate(0, score, {
      duration: 1.3,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [score, prefersReducedMotion]);

  const offset = ARC_LENGTH * (1 - score / 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-56">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(242,239,232,0.1)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <motion.path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={COLORS[level]}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          initial={{ strokeDashoffset: ARC_LENGTH }}
          animate={{ strokeDashoffset: prefersReducedMotion ? offset : offset }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="-mt-10 text-center">
        <p className="text-4xl font-semibold tabular-nums" style={{ color: COLORS[level] }}>
          {Math.round(display)}
        </p>
        <p className="text-xs tracking-wide text-recon-ink-dim">fraud score / 100</p>
      </div>
    </div>
  );
}
