"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Activity, Network, SunMedium } from "lucide-react";

const SIGNALS: {
  key: string;
  numeral: string;
  icon: typeof SunMedium;
  title: string;
  lede: string;
  body: string;
  proof: [string, string][];
}[] = [
  {
    key: "physical",
    numeral: "I",
    icon: SunMedium,
    title: "Physics",
    lede: "Could this plant have produced it?",
    body: "Solar position is computed for the plant's exact coordinates and the claim's exact minute. Clear-sky irradiance and nameplate capacity set a hard ceiling — a claim above it is not a statistical outlier, it's impossible.",
    proof: [
      ["Night solar claim", "0 W/m² available"],
      ["Capacity factor", "> 100% of rating"],
    ],
  },
  {
    key: "statistical",
    numeral: "II",
    icon: Activity,
    title: "Statistics",
    lede: "Does it look like honest generation?",
    body: "An anomaly model scores every claim against its plant's own history and its regional peers — stepped output cliffs, digit distributions that drift from Benford's law, volumes no peer produces.",
    proof: [
      ["Model output", "0–100 fraud score"],
      ["Explained", "Plain-English reasons"],
    ],
  },
  {
    key: "network",
    numeral: "III",
    icon: Network,
    title: "Custody",
    lede: "Where does the energy end up?",
    body: "Certificates are traced from generator to holder. Flagged energy pooling in one wallet across many plants, or looping back to an issuer's affiliate, surfaces as a topology finding.",
    proof: [
      ["Concentration", "Per-wallet share"],
      ["Loops", "Issuer affiliates"],
    ],
  },
];

export function SignalsSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.7", "end 0.4"] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.3 });
  const railHeight = useTransform(progress, [0, 1], ["0%", "100%"]);

  return (
    <section id="signals" ref={ref} className="relative scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="label-caps text-gold">The signal triangle</p>
          <h2 className="font-display mt-3 text-[36px] leading-[1.05] font-bold tracking-[-0.03em] text-recon-ink sm:text-5xl">
            Three independent witnesses. <span className="text-recon-steel">One verdict.</span>
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-7 text-recon-ink-dim">
            A single model can be gamed. Three methods that share no inputs are much harder to fool at once — so every certificate is
            examined by all three, and fused into one composite confidence.
          </p>

          <div className="relative mt-10 hidden pl-6 lg:block">
            <div className="absolute top-0 bottom-0 left-0 w-px bg-recon-ink/10" />
            <motion.div style={reduce ? { height: "100%" } : { height: railHeight }} className="absolute top-0 left-0 w-px bg-gradient-to-b from-gold to-risk" />
            <ul className="space-y-5">
              {SIGNALS.map((s) => (
                <li key={s.key} className="flex items-baseline gap-3">
                  <span className="mono-micro text-recon-steel">{s.numeral}</span>
                  <span className="text-[15px] font-semibold text-recon-ink">{s.title}</span>
                  <span className="text-[13px] text-recon-ink-dim">— {s.lede}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {SIGNALS.map((signal, i) => (
            <SignalCard key={signal.key} signal={signal} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SignalCard({ signal, index }: { signal: (typeof SIGNALS)[number]; index: number }) {
  const reduce = useReducedMotion();
  const Icon = signal.icon;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="glass glass-medium glass-hover relative overflow-hidden rounded-[28px] p-6 sm:p-7"
    >
      <span aria-hidden className="font-display pointer-events-none absolute -top-4 right-5 text-[96px] leading-none font-bold text-recon-ink/[0.05]">
        {signal.numeral}
      </span>
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/70 text-gold shadow-[inset_0_1px_0_#fff]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="label-caps text-recon-steel">Check {index + 1} of 3</span>
      </div>
      <h3 className="font-display mt-5 text-[28px] leading-8 font-bold tracking-tight text-recon-ink">{signal.title}</h3>
      <p className="mt-1 text-[15px] font-medium text-gold">{signal.lede}</p>
      <p className="mt-3 max-w-2xl text-[14px] leading-6 text-recon-ink-dim">{signal.body}</p>
      <dl className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md">
        {signal.proof.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/80 bg-white/55 px-3 py-2">
            <dt className="label-caps text-recon-steel">{k}</dt>
            <dd className="mono-micro mt-0.5 text-recon-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </motion.article>
  );
}
