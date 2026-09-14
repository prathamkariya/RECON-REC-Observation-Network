"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Crosshair, Flag, Gauge, MapPin, MoonStar, Radar, ScanSearch, Sigma, SunMedium, TableProperties, Zap } from "lucide-react";
import { useCertificate, useCertificates } from "@/lib/hooks/use-certificates";
import { EnvelopeChart, EnvelopeLegend } from "@/components/physical/envelope-chart";
import { LiveDot, Panel, PanelHeader } from "@/components/glass/panel";
import { SignalBadge } from "@/components/glass/signal-badge";
import { ConsoleSkeleton, ErrorPanel, Shimmer } from "@/components/glass/states";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCoord, physicalReport } from "@/lib/analytics";
import { formatMwh } from "@/lib/format";

function PhysicalValidation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: certificates, isLoading: listLoading, isError: listError } = useCertificates();

  const requested = searchParams.get("id");
  const defaultId = certificates?.length ? [...certificates].sort((a, b) => b.fraud_score - a.fraud_score)[0].token_id : undefined;
  const tokenId = requested !== null && requested !== "" ? Number(requested) : defaultId;
  const { data: certificate, isLoading, isError } = useCertificate(tokenId ?? Number.NaN);

  if (listLoading || (tokenId !== undefined && isLoading)) return <ConsoleSkeleton kpis={4} />;
  if (listError || !certificates) return <ErrorPanel />;
  if (!certificates.length) return <ErrorPanel title="No certificates to validate yet">Issue a certificate to run a physical validation.</ErrorPanel>;
  if (isError || !certificate) return <ErrorPanel title={`No certificate found for token #${requested}`} />;

  const report = physicalReport(certificate);
  const solar = report.plantType.toLowerCase().includes("solar");
  const serial = `REC-${String(certificate.token_id).padStart(5, "0")}`;
  const violation = report.verdict === "violation";
  const peak = report.envelope.reduce((best, p) => (p.ghi > best.ghi ? p : best), report.envelope[0]);

  const sensors = [
    {
      layer: "Plant self-report",
      source: `${certificate.raw_record.issuer_id.split(" · ")[0]} meter claim`,
      recorded: `${(report.claimedMw * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} kW`,
      expected: `≤ ${((report.physicalMaxMwh / report.windowHours) * 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} kW`,
      status: violation ? "Anomaly" : report.verdict === "marginal" ? "Marginal" : "Concordant",
      tone: violation ? "solid-risk" : report.verdict === "marginal" ? "warn" : "verified",
    },
    {
      layer: "Clear-sky irradiance",
      source: solar ? "Haurwitz model" : "Not applicable",
      recorded: solar ? `${report.ghiAtClaim.toFixed(0)} W/m²` : "—",
      expected: solar ? `${peak.ghi} W/m² peak` : "—",
      status: solar ? (report.nocturnal ? "Zero flux" : "Concordant") : "N/A",
      tone: solar ? (report.nocturnal ? "risk" : "verified") : "neutral",
    },
    {
      layer: "Solar geometry",
      source: "NOAA position algorithm",
      recorded: `${report.elevationAtClaim.toFixed(2)}°`,
      expected: solar ? "> 0° for generation" : "Any",
      status: solar && report.nocturnal ? "Below horizon" : "Concordant",
      tone: solar && report.nocturnal ? "risk" : "verified",
    },
    {
      layer: "Nameplate capacity",
      source: "Registry plant record",
      recorded: `${(report.capacityFactor * 100).toFixed(1)}% CF`,
      expected: "≤ 100% CF",
      status: report.capacityFactor > 1 ? "Exceeded" : "Within rating",
      tone: report.capacityFactor > 1 ? "risk" : "verified",
    },
    {
      layer: "Backend fraud model",
      source: "Statistical pipeline",
      recorded: `${certificate.fraud_score}/100`,
      expected: "< 50",
      status: certificate.fraud_score >= 50 ? "Flagged" : "Cleared",
      tone: certificate.fraud_score >= 50 ? "risk" : "verified",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link href={`/certificates/${certificate.token_id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-recon-steel hover:text-gold">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to {serial}
            </Link>
            <h1 className="mt-2 text-[26px] leading-[34px] font-bold tracking-tight text-recon-ink sm:text-[32px] sm:leading-10">
              Physics check
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-recon-ink-dim">
              Could this plant physically have produced what the certificate claims? Modelled from its capacity, location and the time of generation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(certificate.token_id)}
              onValueChange={(v) => router.replace(`/physical?id=${v}`, { scroll: false })}
            >
              <SelectTrigger className="h-10 min-w-[260px] rounded-xl bg-white/70" aria-label="Certificate under validation">
                <SelectValue>
                  {(v: string) => {
                    const c = certificates.find((x) => String(x.token_id) === v);
                    return c ? `REC-${String(c.token_id).padStart(5, "0")} · ${c.plant_id}` : v;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[...certificates]
                  .sort((a, b) => b.fraud_score - a.fraud_score)
                  .map((c) => (
                    <SelectItem key={c.token_id} value={String(c.token_id)}>
                      REC-{String(c.token_id).padStart(5, "0")} · {c.plant_id} · {c.fraud_score}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Link
              href={`/certificates/${certificate.token_id}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 px-4 text-sm font-medium text-recon-ink shadow-[inset_0_1px_0_#fff] hover:border-recon-ink/40"
            >
              <ScanSearch className="h-4 w-4" /> Open certificate
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal y={10}>
        <div className="glass glass-thin flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl px-5 py-3">
          <span className="mono-micro text-recon-steel">
            CERTIFICATE: <span className="font-semibold text-recon-ink">{serial} · {certificate.plant_id}</span>
          </span>
          <span className="mono-micro text-recon-steel">
            PLANT: <span className="font-semibold text-recon-ink">{report.capacityMw} MW {report.plantType.toUpperCase()}</span>
          </span>
          <span className="mono-micro flex items-center gap-1.5 text-recon-steel">
            <MapPin className="h-3.5 w-3.5" /> <span className="text-recon-ink">{formatCoord(report.lat, report.lon)}</span>
          </span>
          <span className="mono-micro flex items-center gap-1.5 text-verified sm:ml-auto">
            <LiveDot className="h-1.5 w-1.5" /> CLEAR-SKY MODEL · NOAA SOLAR POSITION
          </span>
        </div>
      </Reveal>

      <Reveal>
        <Panel cap={violation ? "risk" : report.verdict === "marginal" ? "warn" : "verified"}>
          <PanelHeader
            icon={SunMedium}
            title="Claimed output vs. physical limit"
            description={`Full day · ${report.windowStart.toISOString().slice(0, 10)} · 00:00–23:59 UTC`}
            actions={<EnvelopeLegend report={report} />}
          />

          <div className="grid-well relative rounded-xl border border-white/70 p-3">
            <EnvelopeChart report={report} height={360} />
            {violation && (
              <div className="pointer-events-none absolute top-14 right-6 hidden max-w-xs rounded-xl border border-risk/25 bg-white/90 p-3 shadow-[0_14px_30px_-14px_rgba(179,38,30,0.45)] backdrop-blur-md md:block">
                <p className="label-caps flex items-center gap-1.5 text-risk">
                  <AlertTriangle className="h-3.5 w-3.5" /> Claim exceeds the physical limit
                </p>
                <p className="mt-1.5 text-[12px] leading-[18px] text-recon-ink-soft">
                  Claimed <span className="font-semibold text-risk">{formatMwh(report.claimedMwh)}</span> against a physical ceiling of{" "}
                  <span className="font-semibold">{formatMwh(report.physicalMaxMwh)}</span>
                  {solar ? ` at ${report.ghiAtClaim.toFixed(0)} W/m² (elevation ${report.elevationAtClaim.toFixed(1)}°)` : ""}.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <SummaryCell label={solar ? "Integrated theoretical potential" : "Daily nameplate potential"} value={`${formatMwh(report.dailyPotentialMwh)}`} note={solar ? "Clear-sky, full day" : "24 h at rating"} />
            <SummaryCell label="Physical ceiling in window" value={formatMwh(report.physicalMaxMwh)} note={`${report.windowHours.toFixed(1)} h window`} />
            <SummaryCell label="Total reported generation" value={formatMwh(report.claimedMwh)} note={violation ? "Violation" : report.verdict === "marginal" ? "Marginal" : "Consistent"} risk={violation} />
          </div>
        </Panel>
      </Reveal>

      <Stagger className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <GeometryCard
            icon={report.nocturnal ? MoonStar : SunMedium}
            label="Celestial geometry"
            value={`${report.elevationAtClaim.toFixed(2)}°`}
            status={report.nocturnal ? "Deep nocturnal window" : report.elevationAtClaim < 15 ? "Low sun angle" : "Daylight"}
            risk={solar && report.nocturnal}
            body={
              solar
                ? report.nocturnal
                  ? "The sun is below the horizon at the plant: photovoltaic excitation is physically impossible."
                  : "The sun is above the horizon at the plant during the claim window."
                : "Solar geometry doesn't constrain this plant type; nameplate rating does."
            }
          />
        </StaggerItem>
        <StaggerItem>
          <GeometryCard
            icon={Radar}
            label="Clear-sky GHI"
            value={solar ? `${report.ghiAtClaim.toFixed(1)} W/m²` : "N/A"}
            status={solar ? "Modelled irradiance" : "Non-solar asset"}
            risk={solar && report.ghiAtClaim < 1 && report.claimedMwh > 0}
            body={solar ? `Peak for the day: ${peak.ghi} W/m² at ${peak.label} UTC.` : "Irradiance is not an input for this generation source."}
          />
        </StaggerItem>
        <StaggerItem>
          <GeometryCard
            icon={Gauge}
            label="Capacity factor"
            value={`${(report.capacityFactor * 100).toFixed(1)}%`}
            status={report.capacityFactor > 1 ? "Exceeds nameplate" : "Within rating"}
            risk={report.capacityFactor > 1}
            body={`${formatMwh(report.claimedMwh)} over ${report.windowHours.toFixed(1)} h on a ${report.capacityMw} MW plant.`}
          />
        </StaggerItem>
        <StaggerItem>
          <GeometryCard
            icon={Sigma}
            label="Discrepancy delta"
            value={`${report.discrepancyMwh > 0 ? "+" : ""}${formatMwh(report.discrepancyMwh)}`}
            status={report.discrepancyMwh > 0 ? "Phantom yield" : "Headroom"}
            risk={report.discrepancyMwh > 0}
            body={report.discrepancyMwh > 0 ? "Energy claimed beyond anything the plant could physically produce." : "Claim is inside the plant's physical ceiling."}
          />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <Panel className="h-full">
            <PanelHeader
              icon={TableProperties}
              title="Check by check"
              description="The claim compared against each independent physical and model check."
              actions={<span className="mono-micro text-recon-steel">SNAPSHOT {report.windowStart.toISOString().slice(0, 16).replace("T", " ")} UTC</span>}
            />
            <div className="-mx-5 overflow-x-auto sm:-mx-6" data-lenis-prevent>
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-y border-recon-ink/[0.07] bg-white/40">
                    {["Check", "Source", "Value", "Expected", "Status"].map((h, i) => (
                      <th key={h} className={"label-caps px-5 py-2.5 text-recon-steel sm:px-6 " + (i === 2 || i === 3 ? "text-right" : "")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensors.map((row) => (
                    <tr key={row.layer} className={"h-12 border-b border-recon-ink/[0.05] last:border-0 " + (row.tone === "solid-risk" ? "bg-risk/[0.05]" : "")}>
                      <td className="px-5 text-[13px] font-semibold text-recon-ink sm:px-6">{row.layer}</td>
                      <td className="mono-micro px-5 text-recon-steel sm:px-6">{row.source}</td>
                      <td className={"mono-data px-5 text-right sm:px-6 " + (row.tone === "solid-risk" || row.tone === "risk" ? "font-semibold text-risk" : "text-recon-ink")}>{row.recorded}</td>
                      <td className="mono-data px-5 text-right text-recon-ink-soft sm:px-6">{row.expected}</td>
                      <td className="px-5 sm:px-6">
                        <SignalBadge tone={row.tone}>{row.status}</SignalBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-recon-ink/[0.07] bg-white/50 px-4 py-3">
              <span className="label-caps flex items-center gap-2 text-recon-steel">
                <Crosshair className="h-3.5 w-3.5" /> Discrepancy delta
              </span>
              <span className={"mono-data font-semibold " + (report.discrepancyMwh > 0 ? "text-risk" : "text-verified")}>
                {report.discrepancyMwh > 0 ? "+" : ""}
                {formatMwh(report.discrepancyMwh)} ({report.physicalMaxMwh > 0 ? `${report.discrepancyPct > 0 ? "+" : ""}${report.discrepancyPct.toFixed(1)}%` : "impossibility index 100%"})
              </span>
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.06} className="lg:col-span-2">
          <Panel className="h-full">
            <PanelHeader icon={MapPin} title="Plant location" description="The coordinates the solar model runs against." />
            <div className="grid-well flex flex-col items-center justify-center gap-2 rounded-xl border border-white/70 px-4 py-10 text-center">
              <MapPin className={"h-8 w-8 " + (violation ? "text-risk" : "text-gold")} />
              <p className="mono-data font-semibold text-recon-ink">{formatCoord(report.lat, report.lon)}</p>
              <p className="text-[13px] text-recon-ink-dim">
                {certificate.plant_id} · {report.capacityMw} MW {report.plantType}
              </p>
              <a
                href={`https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lon}#map=12/${report.lat}/${report.lon}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl border border-recon-ink/15 bg-white/75 px-3.5 text-sm font-medium text-recon-ink hover:border-recon-ink/40"
              >
                View on map <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-recon-ink/[0.07] pt-3">
              {[
                ["Model", "Haurwitz"],
                ["Resolution", "15 min"],
                ["Perf. ratio", "0.82"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-caps text-recon-steel">{k}</dt>
                  <dd className="mono-micro mt-0.5 text-recon-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </Reveal>
      </div>

      <Reveal>
        <Panel cap={violation ? "risk" : "verified"}>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className={"label-caps flex items-center gap-2 " + (violation ? "text-risk" : "text-verified")}>
                {violation ? <Flag className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                {violation ? "Finding: physically impossible" : "Finding: physically consistent"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-recon-ink sm:text-2xl">
                {violation
                  ? report.nocturnal
                    ? "Solar generation was claimed while the sun was below the horizon"
                    : "The claim is more than the plant can physically produce"
                  : report.verdict === "marginal"
                    ? "Claim is physically possible, with little headroom"
                    : "Claim is consistent with the plant's physics"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-recon-ink-dim">
                Generation claim for <span className="font-semibold text-recon-ink">{serial} ({formatMwh(report.claimedMwh)})</span>{" "}
                {violation
                  ? `exceeds the ${formatMwh(report.physicalMaxMwh)} a ${report.capacityMw} MW ${report.plantType} plant can physically deliver in its window. No storage or hybrid dispatch is recorded for this facility, so the metered output must be reconciled against inverter logs before this certificate is relied upon.`
                  : `sits within the ${formatMwh(report.physicalMaxMwh)} the plant can physically deliver in its window.`}
              </p>
              <p className="mono-micro mt-4 text-recon-steel">
                SEVERITY: <span className={violation ? "font-semibold text-risk" : "text-verified"}>{violation ? "PHYSICAL VIOLATION" : "NONE"}</span>
              </p>
            </div>
            <div className="space-y-2.5">
              <Link
                href={`/certificates/${certificate.token_id}`}
                className={
                  "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors " +
                  (violation ? "bg-risk hover:bg-risk-deep" : "bg-recon-forest hover:bg-[#1b4332]")
                }
              >
                Open certificate <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/verify?id=${certificate.token_id}`}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-recon-ink/15 bg-white/75 text-sm font-medium text-recon-ink hover:border-recon-ink/40"
              >
                <ScanSearch className="h-4 w-4" /> Public verification
              </Link>
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}

function SummaryCell({ label, value, note, risk }: { label: string; value: string; note: string; risk?: boolean }) {
  return (
    <div className={"rounded-xl border px-4 py-3 " + (risk ? "border-risk/20 bg-risk/[0.06]" : "border-white/80 bg-white/55")}>
      <p className={"label-caps " + (risk ? "text-risk" : "text-recon-steel")}>{label}</p>
      <p className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className={"mono-data !text-[16px] font-semibold " + (risk ? "text-risk" : "text-recon-ink")}>{value}</span>
        <span className="mono-micro text-right text-recon-steel">{note}</span>
      </p>
    </div>
  );
}

function GeometryCard({
  icon: Icon,
  label,
  value,
  status,
  body,
  risk,
}: {
  icon: typeof SunMedium;
  label: string;
  value: string;
  status: string;
  body: string;
  risk: boolean;
}) {
  return (
    <div className={"glass glass-medium glass-hover flex h-full flex-col rounded-2xl p-5 " + (risk ? "cap-risk" : "cap-verified")}>
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps text-recon-steel">{label}</span>
        <Icon className={"h-4 w-4 " + (risk ? "text-risk" : "text-recon-steel")} />
      </div>
      <p className={"font-display mt-3 text-2xl font-bold tabular-nums " + (risk ? "text-risk" : "text-recon-ink")}>{value}</p>
      <p className={"label-caps mt-1.5 " + (risk ? "text-risk" : "text-verified")}>{status}</p>
      <p className="mt-3 text-[13px] leading-5 text-recon-ink-dim">{body}</p>
    </div>
  );
}

export default function PhysicalPage() {
  return (
    <Suspense fallback={<Shimmer className="h-[520px] rounded-2xl" />}>
      <PhysicalValidation />
    </Suspense>
  );
}
