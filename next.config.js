/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['storage.googleapis.com', 'bestdiscountsstore.com', 'api.screenshotmachine.com'],
  },
}

module.exports = nextConfig 