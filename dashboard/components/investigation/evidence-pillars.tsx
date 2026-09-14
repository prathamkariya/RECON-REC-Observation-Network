import { Panel } from "@/components/glass/panel";
import { SignalBadge } from "@/components/glass/signal-badge";
import type { PhysicalReport, SignalPillars } from "@/lib/analytics";
import { formatCoord } from "@/lib/analytics";
import { formatMwh, truncateAddress } from "@/lib/format";
import type { OnChainCertificate } from "@/lib/types";

type PillarProps = {
  eyebrow: string;
  title: string;
  score: number;
  rows: [string, string, boolean?][];
  narrative: string;
  footer: [string, string];
};

function Pillar({ eyebrow, title, score, rows, narrative, footer }: PillarProps) {
  const risk = score >= 50;
  const cap = risk ? "risk" : score >= 25 ? "warn" : "verified";
  return (
    <Panel cap={cap} className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className={"label-caps " + (risk ? "text-risk" : "text-verified")}>{eyebrow}</span>
        <SignalBadge tone={risk ? "risk" : score >= 25 ? "warn" : "verified"}>{score}/100 suspicion</SignalBadge>
      </div>
      <h3 className="mt-2 text-lg font-semibold text-recon-ink">{title}</h3>

      <dl className="mt-4 divide-y divide-recon-ink/[0.06] rounded-xl border border-white/80 bg-white/50 px-3">
        {rows.map(([label, value, bad]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2">
            <dt className="label-caps shrink-0 text-recon-steel">{label}</dt>
            <dd className={"mono-micro text-right " + (bad ? "font-semibold text-risk" : "text-recon-ink-soft")}>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex-1 text-[13px] leading-5 text-recon-ink-dim">{narrative}</p>

      <div className={"mt-4 flex items-center justify-between rounded-lg px-3 py-2 " + (risk ? "bg-risk/[0.07]" : "bg-verified/[0.07]")}>
        <span className="label-caps text-recon-steel">{footer[0]}</span>
        <span className={"mono-micro font-semibold " + (risk ? "text-risk" : "text-verified")}>{footer[1]}</span>
      </div>
    </Panel>
  );
}

export function EvidencePillars({
  certificate,
  report,
  pillars,
  ownerShare,
}: {
  certificate: OnChainCertificate;
  report: PhysicalReport;
  pillars: SignalPillars;
  ownerShare: { held: number; ofPlant: number };
}) {
  const solar = report.plantType.toLowerCase().includes("solar");
  const surplus = report.discrepancyMwh;

  const physicalNarrative =
    report.verdict === "violation"
      ? report.nocturnal
        ? `${certificate.plant_id} reported ${formatMwh(report.claimedMwh)} while the sun sat ${Math.abs(report.elevationAtClaim).toFixed(1)}° below the horizon at its coordinates. Photovoltaic generation without irradiance breaches basic thermodynamics.`
        : `The claim exceeds what a ${report.capacityMw} MW ${report.plantType} plant can physically deliver in a ${report.windowHours.toFixed(1)}h window by ${formatMwh(Math.max(0, surplus))}.`
      : report.verdict === "marginal"
        ? `The claim sits at ${((report.claimedMwh / Math.max(report.physicalMaxMwh, 0.001)) * 100).toFixed(0)}% of the modelled physical ceiling — plausible, but with little headroom.`
        : `The claim sits comfortably inside the modelled physical ceiling for this plant and window.`;

  const statNarrative = certificate.risk_reasons.length
    ? certificate.risk_reasons.join(". ") + "."
    : "The backend model found no statistical indicators for this claim.";

  const custodyConcentration = ownerShare.ofPlant ? Math.round((ownerShare.held / ownerShare.ofPlant) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Pillar
        eyebrow="Pillar I · Physics"
        title={report.nocturnal ? "Zero-irradiance generation window" : solar ? "Irradiance envelope check" : "Nameplate capacity check"}
        score={pillars.physical}
        rows={[
          ["Claimed output", `${formatMwh(report.claimedMwh)} (${report.capacityMw} MW cap)`, report.verdict === "violation"],
          ["Physical ceiling", formatMwh(report.physicalMaxMwh), false],
          [solar ? "Sun elevation" : "Window", solar ? `${report.elevationAtClaim.toFixed(2)}°` : `${report.windowHours.toFixed(1)} h`, report.nocturnal],
          ["Coordinates", formatCoord(report.lat, report.lon), false],
        ]}
        narrative={physicalNarrative}
        footer={["Discrepancy delta", surplus > 0 ? `+${formatMwh(surplus)} phantom` : `${formatMwh(Math.abs(surplus))} headroom`]}
      />
      <Pillar
        eyebrow="Pillar II · Statistics"
        title={certificate.fraud_score >= 50 ? "Model flags this claim" : "Model clears this claim"}
        score={pillars.statistical}
        rows={[
          ["Fraud score", `${certificate.fraud_score} / 100`, certificate.fraud_score >= 50],
          ["Indicators", String(certificate.risk_reasons.length), certificate.risk_reasons.length > 0],
          ["Capacity factor", `${(report.capacityFactor * 100).toFixed(1)}%`, report.capacityFactor > 1],
          ["Issuer", certificate.raw_record.issuer_id, false],
        ]}
        narrative={statNarrative}
        footer={["Model verdict", certificate.fraud_score >= 50 ? "Flagged" : "Cleared"]}
      />
      <Pillar
        eyebrow="Pillar III · Custody"
        title="Holding & transfer topology"
        score={pillars.network}
        rows={[
          ["Current holder", truncateAddress(certificate.owner_address), false],
          ["Minted to", truncateAddress(certificate.raw_record.to_address), false],
          ["Plant certs held", `${ownerShare.held} of ${ownerShare.ofPlant}`, custodyConcentration >= 75 && ownerShare.ofPlant > 1],
          ["Status", certificate.status.toUpperCase(), false],
        ]}
        narrative={
          ownerShare.ofPlant > 1
            ? `This wallet holds ${custodyConcentration}% of ${certificate.plant_id}'s certificates on the registry.${certificate.risk_reasons.some((r) => /trad|loop|cycle/i.test(r)) ? " The backend also reported a trading-graph pattern." : ""}`
            : `This is the only certificate on the registry from ${certificate.plant_id}, so custody concentration can't be assessed yet.`
        }
        footer={["Graph status", pillars.network >= 50 ? "Pattern flagged" : "No cycle detected"]}
      />
    </div>
  );
}
