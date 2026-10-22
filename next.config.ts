import type { NextConfig } from "next";
import { shoeboxSharpIncludes } from "./scripts/shoebox-sharp-includes.mjs";

// Applied to every shoebox page, RSC, API, redirect and error response.
const SHOEBOX_HEADERS = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=()",
  },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

// media-validation.ts starts src/features/shoebox/server/media-worker.mjs by
// its fixed path, which file tracing cannot see. Keep the worker, its shared
// inspection module, Mediabunny and the worker's own Sharp/native dependencies
// in every memory route. Next may use a different Sharp version; its server
// trace is not evidence that this worker's dependencies were packaged.
const MEDIA_WORKER_TRACE = [
  "./src/features/shoebox/server/media-worker.mjs",
  "./src/features/shoebox/media-inspection.mjs",
  "./node_modules/mediabunny/package.json",
  "./node_modules/mediabunny/dist/modules/**/*.js",
  ...shoeboxSharpIncludes(),
];

const nextConfig: NextConfig = {
  // Test tooling output isolation only, never an auth/data fixture switch.
  distDir:
    process.env.SHOEBOX_ISOLATED_CHECK === "1"
      ? ".next/shoebox-check"
      : ".next",
  experimental: {
    useTypeScriptCli: true,
  },
  outputFileTracingIncludes: {
    // Next matches keys with picomatch `contains`, so this covers the upload
    // route and every nested memories route (including [id]/media).
    "/api/shoebox/memories": MEDIA_WORKER_TRACE,
  },
  async headers() {
    return ["/shoebox/:path*", "/api/shoebox/:path*"].map((source) => ({
      source,
      headers: SHOEBOX_HEADERS,
    }));
  },
  images: {
    // Only public artwork may be optimized; never /api/shoebox/** or any query.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      // `next dev` makes next/image throw in the browser for unlisted local
      // paths, which breaks the synthetic birthday fixtures (their optimizer
      // requests are intercepted by Playwright). Production never lists it.
      ...(process.env.NODE_ENV === "production"
        ? []
        : [{ pathname: "/__fixtures/**", search: "" }]),
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "prod-files-secure.s3.us-west-2.amazonaws.com",
      },
      { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
    ],
  },
};

export default nextConfig;
