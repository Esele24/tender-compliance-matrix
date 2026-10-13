import type { MetadataRoute } from "next";

/* Private staff workspace. Authentication remains the actual access boundary. */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
