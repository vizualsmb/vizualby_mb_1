import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return { beforeFiles: [
      { source: "/", has: [{ type: "host", value: "book.vizualbymb.com" }], destination: "/booking" },
      { source: "/", has: [{ type: "host", value: "booking.vizualbymb.com" }], destination: "/booking" },
      { source: "/", has: [{ type: "host", value: "admin.vizualbymb.com" }], destination: "/admin" },
    ] };
  },
  async headers() {
    return [
      { source: "/booking/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
      { source: "/api/booking/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Content-Type-Options", value: "nosniff" }] },
    ];
  },
};

export default nextConfig;
