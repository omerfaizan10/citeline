import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/search.ts reads data/embeddings.json via fs at runtime, which
  // Next.js can't detect through static analysis — without this, the
  // file gets left out of the deployed serverless function.
  outputFileTracingIncludes: {
    "/api/ask": ["./data/embeddings.json"],
  },
};

export default nextConfig;
