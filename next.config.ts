import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Mengabaikan error TypeScript saat build Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Mengabaikan error ESLint saat build Vercel
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;