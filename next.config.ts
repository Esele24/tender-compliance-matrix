import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs ships its own worker and font data and breaks when bundled — let Node
  // require it from node_modules instead.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    '/api/extract': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
    '/api/profile-docs': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'],
  },
};

export default nextConfig;
