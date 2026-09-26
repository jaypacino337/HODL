/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @board/shared ships TypeScript source; Next compiles it in place so the
  // site needs no separate package build (keeps Vercel import zero-config).
  transpilePackages: ["@board/shared"],
};

module.exports = nextConfig;
