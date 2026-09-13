import { FilePlus2, FileBadge2, LayoutGrid, Network, ScanSearch, ShieldAlert, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; group: string };

export const NAV_GROUPS = ["Registry", "Analysis", "Public"] as const;

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, group: "Registry" },
  { href: "/certificates", label: "Certificates", icon: FileBadge2, group: "Registry" },
  { href: "/issue", label: "Issue certificate", icon: FilePlus2, group: "Registry" },
  { href: "/fraud", label: "Fraud review", icon: ShieldAlert, group: "Analysis" },
  { href: "/network", label: "Custody network", icon: Network, group: "Analysis" },
  { href: "/verify", label: "Verify", icon: ScanSearch, group: "Public" },
];

/** Pages reachable from inside the app but not listed in the sidebar. */
const TITLES: [prefix: string, title: string][] = [
  ["/certificates/", "Certificate"],
  ["/physical", "Physics check"],
];

export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function pageTitle(pathname: string): string {
  const exact = NAV_ITEMS.find((item) => pathname === item.href);
  if (exact) return exact.label;
  return TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? activeNavItem(pathname)?.label ?? "Console";
}
