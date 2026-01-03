/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'justjerk.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'search.pstatic.net',
      },
      {
        protocol: 'https',
        hostname: '*.pstatic.net',
      },
      {
        protocol: 'https',
        hostname: 'ldb-phinf.pstatic.net',
      },
    ],
    unoptimized: false,
  },
  // 파일 감시 최적화 - 불필요한 폴더 제외
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // 1초마다 체크 (Windows에서 더 안정적)
        aggregateTimeout: 300, // 300ms 동안 변경사항을 모아서 한 번만 재컴파일
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/test-results/**',
          '**/playwright-report/**',
          '**/coverage/**',
          '**/*.log',
          '**/dist/**',
          '**/build/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;

