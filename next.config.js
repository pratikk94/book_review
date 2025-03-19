/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/index',
        destination: '/',
        permanent: true,
      }
    ]
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
}

module.exports = nextConfig 