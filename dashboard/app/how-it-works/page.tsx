import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PublicHeader } from "@/components/landing/public-header";
import { PipelineScroll } from "@/components/landing/pipeline-scroll";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader current="how-it-works" />

      <div className="mx-auto max-w-2xl px-6 pt-8 pb-4 text-center">
        <p className="text-xs tracking-wide text-recon-ink-dim">How it works</p>
        <h1 className="font-display mt-2 text-3xl font-semibold sm:text-4xl">
          From a plant&apos;s meter to a certificate no one can duplicate
        </h1>
        <p className="mt-3 text-sm text-recon-ink-dim">Scroll to walk through the full lifecycle, end to end.</p>
      </div>

      <PipelineScroll expanded />

      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="mb-4 text-sm text-recon-ink-dim">Ready to see it live?</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/signin" className={buttonVariants({})}>
            Sign in
          </Link>
          <Link href="/verify" className={buttonVariants({ variant: "outline" })}>
            Verify a certificate
          </Link>
        </div>
      </footer>
    </div>
  );
}
