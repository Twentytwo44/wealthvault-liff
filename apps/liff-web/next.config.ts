import type { NextConfig } from "next";

let devOrigin: string | undefined;
if (process.env.NODE_ENV === "development" && process.env.APP_ORIGIN) {
  try {
    devOrigin = new URL(process.env.APP_ORIGIN).hostname;
  } catch {
    // Invalid APP_ORIGIN is rejected by request security and readiness checks.
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: devOrigin ? [devOrigin] : [],
  transpilePackages: ["@wealthvault/contracts"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }]
      }
    ];
  }
};

export default nextConfig;
