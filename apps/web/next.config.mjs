/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@macroscope/db", "@macroscope/tools", "@macroscope/agent"],
  experimental: {
    serverComponentsExternalPackages: ["postgres", "drizzle-orm", "bullmq", "ioredis"],
  },
  webpack: (config) => {
    // Workspace packages use ESM .js suffix on .ts source — teach webpack
    // to resolve those without a build step.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
