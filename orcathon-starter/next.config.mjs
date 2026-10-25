/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Region crops are sent to a Server Action for AI classification.
    serverActions: { bodySizeLimit: "4mb" },
  },
};
export default nextConfig;
