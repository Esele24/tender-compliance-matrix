import type { MetadataRoute } from "next";

/* Lists every real page for crawlers. Single-page sites still get one entry —
   an empty sitemap is worse than a small one. */

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "https://tender-compliance-matrix.vercel.app", lastModified: now, changeFrequency: "monthly" as const, priority: 1 },
  ];
}