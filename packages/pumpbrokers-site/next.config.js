/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // config/ lives outside this package; Next needs to know it may compile TS there.
  transpilePackages: [],
  experimental: { externalDir: true },
};
