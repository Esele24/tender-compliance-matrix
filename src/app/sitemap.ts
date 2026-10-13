import type { MetadataRoute } from "next";

/* Private staff pages are not published in a search-engine sitemap. */

export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
