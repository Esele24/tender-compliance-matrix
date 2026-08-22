import type { MetadataRoute } from "next";

/* Tells crawlers the site may be indexed and where the sitemap is. Without
   it /robots.txt is a 404, which is not fatal but is the first thing an SEO
   audit flags. /api is excluded because those routes are not pages. */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: "https://tender-compliance-matrix.vercel.app/sitemap.xml",
  };
}