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
  api: {
    responseLimit: false, // No response size limit
    bodyParser: {
      sizeLimit: '10mb', // Allow larger file uploads
    },
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
    largePageData: true,
  },
}

module.exports = nextConfig 