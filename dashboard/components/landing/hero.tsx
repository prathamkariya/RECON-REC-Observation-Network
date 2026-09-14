"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, BadgeCheck, FileBadge2, ScanSearch, TriangleAlert } from "lucide-react";
import { LiveDot } from "@/components/glass/panel";
import { SignalBadge, severityLabel, toneForScore } from "@/components/glass/signal-badge";
import { Shimmer } from "@/components/glass/states";
import { chainName } from "@/lib/chain";
import { certificateSerial, formatMwh, formatRelative } from "@/lib/format";
import { useCertificates } from "@/lib/hooks/use-certificates";
import { FRAUD_FLAG_THRESHOLD, type CertificateListItem } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE = ["Every", "megawatt-hour,"];
const HEADLINE_ACCENT = ["cross-examined."];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { data: certificates, isLoading, isError } = useCertificates();

  // Scroll parallax: the copy drifts up and softens as the hero leaves.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const copyY = useTransform(smooth, [0, 1], [0, -80]);
  const copyOpacity = useTransform(smooth, [0, 0.7], [1, 0]);
  const cardY = useTransform(smooth, [0, 1], [0, 60]);

  const total = certificates?.length ?? 0;
  const flagged = certificates?.filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD) ?? [];
  const mwh = certificates?.reduce((s, c) => s + c.energy_mwh, 0) ?? 0;

  return (
    <section ref={ref} className="relative isolate overflow-hidden px-4 pt-28 pb-16 sm:px-6 sm:pt-32 lg:min-h-[92svh] lg:pt-36 lg:pb-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <motion.div style={reduce ? undefined : { y: copyY, opacity: copyOpacity }} className="relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/55 py-1.5 pr-3.5 pl-3 text-xs font-medium text-recon-ink-soft shadow-[inset_0_1px_0_#fff,0_8px_20px_-12px_rgba(19,27,46,0.3)] backdrop-blur-xl"
          >
            <LiveDot className="h-1.5 w-1.5" tone={isError ? "risk" : "verified"} />
            Renewable energy certificate registry
          </motion.p>

          <h1 className="font-display mt-6 text-[42px] leading-[1.02] font-bold tracking-[-0.035em] text-recon-ink sm:text-[62px] lg:text-[64px] xl:text-[76px]">
            {HEADLINE.map((word, i) => (
              <span key={word} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: EASE }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
            <br className="hidden sm:block" />
            {HEADLINE_ACCENT.map((word, i) => (
              <span key={word} className="inline-block overflow-hidden pb-[0.12em] align-bottom whitespace-nowrap">
                <motion.span
                  className="inline-block bg-gradient-to-r from-[#1b4332] via-[#3c6450] to-[#6f9d86] bg-clip-text text-transparent"
                  initial={reduce ? false : { y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.26 + i * 0.08, ease: EASE }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
            className="mt-6 max-w-xl text-[17px] leading-7 text-recon-ink-dim sm:text-lg sm:leading-8"
          >
            RECON checks every renewable energy certificate against plant physics, statistics and its trading history — then records it
            on-chain so the same generation can never be sold twice.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.58, ease: EASE }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Link
              href="/dashboard"
              className="sheen group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-recon-forest px-6 text-[15px] font-semibold text-white shadow-[0_18px_40px_-16px_rgba(15,42,32,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#1b4332]"
            >
              Open the dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="sheen-bar" />
            </Link>
            <Link
              href="/verify"
              className="glass glass-thin inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-[15px] font-semibold text-recon-ink transition-all hover:-translate-y-0.5"
            >
              <ScanSearch className="h-4 w-4 text-gold" /> Verify a certificate
            </Link>
          </motion.div>

          <motion.dl
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-10 grid max-w-lg grid-cols-3 divide-x divide-recon-ink/10 rounded-2xl border border-white/70 bg-white/35 py-3 backdrop-blur-md"
          >
            {[
              [certificates ? total.toLocaleString() : "—", "Certificates"],
              [certificates ? Math.round(mwh).toLocaleString() : "—", "MWh certified"],
              [certificates ? String(flagged.length) : "—", "Flagged"],
            ].map(([value, label], i) => (
              <div key={label} className="px-4">
                <dt className="label-caps text-recon-steel">{label}</dt>
                <dd className={"font-display mt-1 text-2xl font-bold tabular-nums " + (i === 2 && flagged.length ? "text-risk" : "text-recon-ink")}>
                  {value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          style={reduce ? undefined : { y: cardY }}
          initial={reduce ? false : { opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
          className="relative mx-auto w-full max-w-[560px] lg:mx-0"
        >
          <RegistryPreview certificates={certificates} isLoading={isLoading} isError={isError} />
        </motion.div>
      </div>
    </section>
  );
}

/** The newest certificates on the registry, straight from the API. */
function RegistryPreview({
  certificates,
  isLoading,
  isError,
}: {
  certificates?: CertificateListItem[];
  isLoading: boolean;
  isError: boolean;
}) {
  const latest = [...(certificates ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5);
  const worst = [...(certificates ?? [])].filter((c) => c.fraud_score >= FRAUD_FLAG_THRESHOLD).sort((a, b) => b.fraud_score - a.fraud_score)[0];

  return (
    <div className="glass glass-thick rounded-[28px] p-4 shadow-[0_40px_80px_-30px_rgba(19,27,46,0.45)] sm:p-5">
      <div className="flex items-center justify-between px-1">
        <span className="label-caps flex items-center gap-2 text-recon-steel">
          <FileBadge2 className="h-3.5 w-3.5 text-gold" /> Latest certificates
        </span>
        <span className="mono-micro text-recon-steel">{chainName}</span>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-[58px] rounded-xl" />)}

        {isError && (
          <p className="rounded-xl border border-dashed border-recon-ink/15 p-6 text-center text-sm text-recon-ink-dim">
            The registry is offline right now.
          </p>
        )}

        {certificates && latest.length === 0 && (
          <p className="rounded-xl border border-dashed border-recon-ink/15 p-6 text-center text-sm text-recon-ink-dim">
            No certificates issued yet.{" "}
            <Link href="/issue" className="font-medium text-gold hover:underline">
              Issue the first one
            </Link>
            .
          </p>
        )}

        {latest.map((c, i) => (
          <motion.div
            key={c.token_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease: EASE }}
          >
            <Link
              href={`/certificates/${c.token_id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/60 px-3.5 py-2.5 shadow-[inset_0_1px_0_#fff] transition-colors hover:bg-white/85"
            >
              <span className="min-w-0">
                <span className="mono-data block font-semibold text-recon-ink">{certificateSerial(c.token_id)}</span>
                <span className="block truncate text-[12px] text-recon-ink-dim">
                  {c.plant_id} · {formatMwh(c.energy_mwh)} · {formatRelative(c.created_at)}
                </span>
              </span>
              <SignalBadge tone={toneForScore(c.fraud_score)}>
                {c.fraud_score} · {severityLabel(c.fraud_score)}
              </SignalBadge>
            </Link>
          </motion.div>
        ))}
      </div>

      {certificates && latest.length > 0 && (
        <div className={"mt-3 flex items-center gap-3 rounded-xl px-3.5 py-3 " + (worst ? "cap-risk bg-risk/[0.06]" : "bg-verified/[0.07]")}>
          {worst ? (
            <>
              <TriangleAlert className="h-4 w-4 shrink-0 text-risk" />
              <p className="text-[13px] text-recon-ink-soft">
                <span className="font-semibold text-risk">{worst.plant_id}</span> has the highest-risk claim (score {worst.fraud_score}).{" "}
                <Link href={`/certificates/${worst.token_id}`} className="font-medium text-recon-ink underline-offset-2 hover:underline">
                  See why
                </Link>
              </p>
            </>
          ) : (
            <>
              <BadgeCheck className="h-4 w-4 shrink-0 text-verified" />
              <p className="text-[13px] text-recon-ink-soft">No certificate on the registry is currently flagged.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
