import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ??
      (process.env.VERCEL ? "/api/v1" : "http://localhost:4000/api/v1"),
  },
};

export default nextConfig;
