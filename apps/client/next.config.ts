import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@wavesync/shared"],
};

export default nextConfig;
