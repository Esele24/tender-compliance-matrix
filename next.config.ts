import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs ships its own worker and font data and breaks when bundled — let Node
  // require it from node_modules instead.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
