import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@xenova/transformers", "onnxruntime-node"],

  outputFileTracingIncludes: {
    "/api/documents": ["./node_modules/onnxruntime-node/bin/napi-v3/**/*"],
  },
};

export default nextConfig;