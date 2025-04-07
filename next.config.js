/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['storage.googleapis.com', 'bestdiscountsstore.com', 'api.screenshotmachine.com', 'public.blob.vercel-storage.com'],
    formats: ['image/webp', 'image/avif'],
  },
  // Add configuration for handling domains and subdomains
  async headers() {
    return [
      {
        // Matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  // Enable SWC minification for better performance
  swcMinify: true,
  // Commenting out the standalone output option which is causing build errors
  // output: 'standalone',
}

module.exports = nextConfig 