"use client";

import { useRef, type ComponentType } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { BrainCircuit, FileBadge, Link2, ShieldCheck, Sun } from "lucide-react";
import { cn } from "cn";
import { FraudGauge } from "@/components/issue/fraud-gauge";
import { MintProgress } from "@/components/issue/mint-progress";

type Tone = "gold" | "verified";

type Stage = {
  key: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  detail: string;
  tone: Tone;
};

const STAGES: Stage[] = [
  {
    key: "generation",
    icon: Sun,
    title: "Generation",
    caption: "A plant reports what it produced.",
    detail:
      "Plant ID, energy generated, source, and the exact date and time of generation -- the raw claim everything else is checked against.",
    tone: "gold",
  },
  {
    key: "analysis",
    icon: BrainCircuit,
    title: "AI analysis",
    caption: "Scored for fraud risk in real time.",
    detail:
      "An ML model checks the claim against the plant's physical capacity, its trading graph, and weather history, returning a 0-100 fraud score with plain-English reasoning -- not a black box.",
    tone: "gold",
  },
  {
    key: "certificate",
    icon: FileBadge,
    title: "Certificate composed",
    caption: "Plant data, score, and reasoning become one record.",
    detail:
      "Everything that doesn't need a blockchain's guarantee -- plant details, the fraud score, the AI's reasoning -- lives here, off-chain, where it can be explained, updated, and queried.",
    tone: "gold",
  },
  {
    key: "chain",
    icon: Link2,
    title: "Minted on-chain",
    caption: "One claim goes to Ethereum: this is unique.",
    detail:
      "The smart contract checks the (plant, energy, timestamp) triple against every certificate it has ever minted. If it's already been used, the mint reverts -- on-chain, unconditionally.",
    tone: "verified",
  },
  {
    key: "verified",
    icon: ShieldCheck,
    title: "Verified",
    caption: "Anyone can check it, no account needed.",
    detail:
      "A public verify page reads the chain directly for proof of uniqueness, and the database for the reasoning behind it -- two different guarantees, shown as two different things.",
    tone: "verified",
  },
];

const TONE_GLASS: Record<Tone, string> = { gold: "glass-gold text-gold", verified: "glass-verified text-verified" };

function StageDot({
  index,
  total,
  scrollYProgress,
}: {
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
}) {
  const band = 1 / total;
  const start = index * band;
  const end = start + band;
  const opacity = useTransform(scrollYProgress, [start, start + band * 0.2, end - band * 0.2, end], [0.35, 1, 1, 0.35]);
  const scale = useTransform(scrollYProgress, [start, start + band * 0.2, end - band * 0.2, end], [0.7, 1, 1, 0.7]);

  return <motion.span style={{ opacity, scale }} className="block h-2 w-2 rounded-full bg-gold" />;
}

function StageLayer({
  stage,
  index,
  total,
  scrollYProgress,
  expanded,
}: {
  stage: Stage;
  index: number;
  total: number;
  scrollYProgress: MotionValue<number>;
  expanded: boolean;
}) {
  const band = 1 / total;
  const start = index * band;
  const end = start + band;
  const fadeIn = start + band * 0.2;
  const fadeOut = end - band * 0.2;

  const opacity = useTransform(scrollYProgress, [start, fadeIn, fadeOut, end], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [start, fadeIn], [28, 0]);

  const Icon = stage.icon;

  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <div className={cn("glass mb-6 flex h-20 w-20 items-center justify-center rounded-2xl", TONE_GLASS[stage.tone])}>
        <Icon className="h-9 w-9" />
      </div>
      <p className="font-display text-3xl font-semibold sm:text-4xl">{stage.title}</p>
      <p className="mt-2 max-w-md text-recon-ink-dim">{stage.caption}</p>

      {expanded && (
        <>
          <p className="mt-4 max-w-lg text-sm text-recon-ink-dim">{stage.detail}</p>
          {stage.key === "analysis" && (
            <div className="mt-6">
              <FraudGauge score={12} />
            </div>
          )}
          {stage.key === "chain" && (
            <div className="mt-6">
              <MintProgress />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function StaticStageList({ expanded }: { expanded: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-20">
      {STAGES.map((stage) => {
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex items-start gap-4">
            <div className={cn("glass flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", TONE_GLASS[stage.tone])}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-xl font-semibold">{stage.title}</p>
              <p className="text-sm text-recon-ink-dim">{expanded ? stage.detail : stage.caption}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The generation -> AI analysis -> certificate -> chain -> verified pipeline,
 * scroll-scrubbed: it advances with scroll position, never autoplays. Falls
 * back to a static stacked list under prefers-reduced-motion. `expanded`
 * (used on /how-it-works) adds a paragraph per stage and swaps in the real
 * FraudGauge/MintProgress components instead of building decorative twins. */
export function PipelineScroll({ expanded = false }: { expanded?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  if (prefersReducedMotion) {
    return <StaticStageList expanded={expanded} />;
  }

  const trackHeight = expanded ? "600vh" : "400vh";

  return (
    <div ref={ref} style={{ height: trackHeight }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute top-1/2 left-6 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
          {STAGES.map((stage, i) => (
            <StageDot key={stage.key} index={i} total={STAGES.length} scrollYProgress={scrollYProgress} />
          ))}
        </div>

        {STAGES.map((stage, i) => (
          <StageLayer
            key={stage.key}
            stage={stage}
            index={i}
            total={STAGES.length}
            scrollYProgress={scrollYProgress}
            expanded={expanded}
          />
        ))}
      </div>
    </div>
  );
}
