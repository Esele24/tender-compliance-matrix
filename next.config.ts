/**
 * Next.js deployment settings. PDF.js and native canvas run as external Node packages;
 * explicit file tracing includes the directly loaded worker and its dependencies in both
 * PDF API deployments. Disable the framework header and built-in image optimization.
 */
import type { NextConfig } from "next";
const workerFiles = [
  "./scripts/pdf-worker.cjs",
  "./node_modules/pdfjs-dist/**/*",
  "./node_modules/@napi-rs/**/*",
];
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // The worker path is built at runtime, so tracing needs explicit hints to ship it and its native dependencies.
  outputFileTracingIncludes: {
    "/api/extract": workerFiles,
    "/api/profile-docs": workerFiles,
  },
};
export default nextConfig;
