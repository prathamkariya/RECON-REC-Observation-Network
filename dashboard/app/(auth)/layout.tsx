import Link from "next/link";
import { EngravedPattern } from "@/components/brand/engraved-pattern";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Recon
        </Link>
        <div className="mx-auto w-full max-w-sm py-16">{children}</div>
        <p className="text-xs text-recon-ink-dim">Renewable Energy Certificate registry — Sepolia testnet</p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-recon-surface lg:block">
        <EngravedPattern className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative z-10 flex h-full flex-col justify-end p-16">
          <p className="font-display text-3xl leading-snug font-medium text-recon-ink">
            Every certificate proves one thing on-chain:
            <br />
            <span className="text-gold">it has never been issued before.</span>
          </p>
          <p className="mt-4 max-w-md text-sm text-recon-ink-dim">
            Everything else — plant data, fraud analysis, reasoning — lives off-chain, where it can be
            explained. Only the uniqueness claim needs a chain.
          </p>
        </div>
      </div>
    </div>
  );
}
