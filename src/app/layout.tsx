/**
 * Shared HTML shell for all pages. Load fonts and global styles once and define
 * the title, description, and search-indexing preferences through Next.js metadata.
 * Dynamic rendering supports the request-specific security policy supplied by proxy.ts.
 */
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";


// IBM Plex was drawn for technical and engineering contexts — it carries the
// register of a compliance document without dressing up as one. Mono is not
// decorative here: requirement counts, section references and status codes are
// data, and data lines up.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  metadataBase: new URL("https://tender-compliance-matrix.vercel.app"),
  title: "Compliance Matrix — Tender Response Assistant",
  description:
    "Read a tender against your company's evidence. Every requirement checked, every gap flagged, before the deadline instead of after.",
};

// children is the page content Next.js inserts inside this shared shell.
// The layout supplies <html> and <body>; individual pages supply their own content.
// Readonly is a TypeScript helper describing props that should not be reassigned.
// React.ReactNode means anything React can render, including elements and text.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}

      </body>
    </html>
  );
}
