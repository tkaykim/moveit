/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 소스맵 최적화: 프로덕션에서는 소스맵 비활성화
  productionBrowserSourceMaps: false,
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
      // 개발 환경에서 가벼운 소스맵 사용 (eval-source-map보다 빠름)
      // false로 설정하면 소스맵이 완전히 꺼져서 더 빠르지만 디버깅이 어려워짐
      // 필요시 'cheap-module-source-map' 또는 false로 변경 가능
      config.devtool = 'eval-cheap-module-source-map';
      
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

