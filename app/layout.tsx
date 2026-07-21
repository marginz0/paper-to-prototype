import type { Metadata } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

function parseMetadataBase(value: string | undefined): URL | undefined {
  if (!value) return undefined;

  try {
    const candidate = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (
      (candidate.protocol !== "http:" && candidate.protocol !== "https:") ||
      candidate.username ||
      candidate.password
    ) {
      return undefined;
    }
    return new URL("/", candidate);
  } catch {
    return undefined;
  }
}

const metadataBase =
  parseMetadataBase(process.env.SITE_URL) ??
  parseMetadataBase(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  (process.env.NODE_ENV === "development"
    ? new URL("http://localhost:3000")
    : undefined);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Paper to Prototype",
    template: "%s · Paper to Prototype",
  },
  description:
    "Verified, interactive learning laboratories for the algorithms inside foundational research papers.",
  applicationName: "Paper to Prototype",
  openGraph: {
    type: "website",
    siteName: "Paper to Prototype",
    title: "Paper to Prototype",
    description: "Don’t just read the method. Run it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paper to Prototype",
    description: "Don’t just read the method. Run it.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <div className="site-shell">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
