import type { Metadata } from "next";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

const metadataBase = new URL(
  process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Paper-to-Prototype",
    template: "%s · Paper-to-Prototype",
  },
  description:
    "Verified, interactive learning laboratories for the algorithms inside foundational research papers.",
  applicationName: "Paper-to-Prototype",
  openGraph: {
    type: "website",
    siteName: "Paper-to-Prototype",
    title: "Paper-to-Prototype",
    description: "Don’t just read the method. Run it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paper-to-Prototype",
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
