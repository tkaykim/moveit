import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 성능 최적화
  compress: true,
  poweredByHeader: false,
  
  // 브라우저 호환성 개선
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
  
  // CSS 최적화 및 로딩 보장
  optimizeFonts: true,
  
  // 컴파일 성능 최적화
  swcMinify: true,
  
  // 개발 모드 최적화
  onDemandEntries: {
    maxInactiveAge: 60 * 1000, // 60초
    pagesBufferLength: 5,
  },
  
  // 이미지 최적화 설정
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
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // 브라우저 호환성 개선
  transpilePackages: [],
  
  // 파일 감시 최적화 - 불필요한 폴더 제외
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // 1초마다 체크 (Windows에서 더 안정적)
        aggregateTimeout: 500, // 500ms 동안 변경사항을 모아서 한 번만 재컴파일
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
      
      // 개발 모드 최적화 - 단일 번들로 빠른 컴파일
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        // 개발 모드에서는 splitChunks를 최소화하여 컴파일 속도 향상
        splitChunks: false,
      };
      
      // 캐시 설정 개선 (Windows 호환성)
      // 파일 시스템 캐시를 사용하되, 오류 발생 시 자동으로 메모리 캐시로 전환
      try {
        config.cache = {
          type: 'filesystem',
          buildDependencies: {
            config: [__filename],
          },
          cacheDirectory: path.join(process.cwd(), '.next', 'cache', 'webpack'),
          compression: false, // Windows에서 압축 오류 방지
          maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
          // Windows 파일 시스템 오류 처리
          store: 'pack',
        };
      } catch (error) {
        // 파일 시스템 캐시 실패 시 메모리 캐시 사용
        console.warn('파일 시스템 캐시 설정 실패, 메모리 캐시 사용:', error.message);
        config.cache = {
          type: 'memory',
        };
      }
    }
    
    // 프로덕션 빌드 최적화
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // 공통 라이브러리 분리
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Supabase 클라이언트 분리
            supabase: {
              name: 'supabase',
              chunks: 'all',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 30,
            },
            // React 관련 분리
            react: {
              name: 'react',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              priority: 40,
            },
            // 공통 컴포넌트 분리
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // 헤더 설정 (캐시 및 보안)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

