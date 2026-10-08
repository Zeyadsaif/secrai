/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Graph/MSAL run only in Node server routes, never in the browser bundle.
    serverComponentsExternalPackages: ["@azure/msal-node"],
  },
};
export default nextConfig;
