"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { riskLevel } from "@/lib/types";

const RADIUS = 80;
const ARC_LENGTH = Math.PI * RADIUS; // semicircle
const COLORS = { low: "#2f7a57", medium: "#9a6a14", high: "#b3261e" };

/** A semicircle gauge that fills to a real fraud score once it arrives —
 * never animates before the API has actually returned a value. */
export function FraudGauge({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const level = riskLevel(score);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const controls = animate(0, score, {
      duration: 1.3,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(v),
    });
    return () => controls.stop();
  }, [score, prefersReducedMotion]);

  // Derived rather than set from the effect: with reduced motion there is no
  // animation to run, so the real score is just what renders.
  const display = prefersReducedMotion ? score : animated;

  const offset = ARC_LENGTH * (1 - score / 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-56">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(19,27,46,0.08)"
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
        <p className="font-display text-5xl font-bold tabular-nums" style={{ color: COLORS[level] }}>
          {Math.round(display)}
        </p>
        <p className="label-caps mt-1 text-recon-steel">Fraud score / 100</p>
      </div>
    </div>
  );
}
