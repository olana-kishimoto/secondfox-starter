import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["@supabase/ssr", "@supabase/supabase-js"],
  },
  serverExternalPackages: ["@fontsource/noto-sans-jp"],
  productionBrowserSourceMaps: false,
};

export default nextConfig;
