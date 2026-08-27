import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@life-design/core', '@life-design/checkpoint'],
}

export default nextConfig
