import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Inter } from "next/font/google";
import { Providers } from "@/lib/providers";
import { Toaster } from "@/components/ui/sonner";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import "./globals.css";

// Type roles from the REC Intelligence design system: Geist for display,
// Inter for body/labels, IBM Plex Mono for every serial, hash and coordinate.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "REC Intelligence — Renewable Energy Certificate Forensics",
  description:
    "Every renewable energy certificate cross-examined against physics, statistics and the trading graph — then made impossible to double-issue on-chain.",
};

export const viewport: Viewport = {
  themeColor: "#f4f5f1",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // Keep route changes instant even though in-page scrolling is smooth.
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SmoothScroll />
        <Providers>{children}</Providers>
        <Toaster theme="light" position="top-right" />
      </body>
    </html>
  );
}
