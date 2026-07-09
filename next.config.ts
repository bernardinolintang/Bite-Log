import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // a stray package-lock.json in the user's home dir makes Next infer the wrong root
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
