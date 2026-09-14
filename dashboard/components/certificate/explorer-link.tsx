import { ExternalLink } from "lucide-react";
import { cn } from "cn";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain";
import { truncateAddress, truncateHash } from "@/lib/format";

/**
 * A transaction hash or address, linked to the active chain's block explorer
 * when it has one. A local node has no explorer, so the value renders as
 * plain text instead of a link to a site that can't know about it.
 */
export function ExplorerLink({
  kind,
  value,
  className,
  full = false,
}: {
  kind: "tx" | "address";
  value: string;
  className?: string;
  /** Show the whole value instead of a truncated one. */
  full?: boolean;
}) {
  const href = kind === "tx" ? explorerTxUrl(value) : explorerAddressUrl(value);
  const label = full ? value : kind === "tx" ? truncateHash(value) : truncateAddress(value);

  if (!href) {
    return (
      <span title={value} className={cn("mono-micro", className)}>
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={value}
      className={cn("mono-micro inline-flex items-center gap-1 hover:text-gold", className)}
    >
      {label}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}
