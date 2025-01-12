import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true, // Ignore lint errors
  },
  typescript: {
    ignoreBuildErrors: true, // Ignore type errors
  },
};

export default nextConfig;
