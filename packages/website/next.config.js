/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @overbid/shared ships TypeScript source; Next compiles it in-place so the
  // site needs no separate package build step (keeps Vercel import zero-config).
  transpilePackages: ["@overbid/shared"],
};

module.exports = nextConfig;
