'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SocialLoginButtonsProps {
  redirectTo?: string;
}

export function SocialLoginButtons({ redirectTo }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClient();

  const handleSocialLogin = async (provider: 'google' | 'kakao') => {
    setLoading(provider);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo || '/')}`,
        },
      });

      if (error) {
        console.error(`${provider} 로그인 오류:`, error);
        setLoading(null);
      }
      // 성공 시 자동으로 리다이렉트됨
    } catch (error) {
      console.error(`${provider} 로그인 오류:`, error);
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-300 dark:border-neutral-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400">
            또는
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 구글 로그인 버튼 */}
        <button
          type="button"
          onClick={() => handleSocialLogin('google')}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-neutral-950"
        >
          {loading === 'google' ? (
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            구글
          </span>
        </button>

        {/* 카카오 로그인 버튼 */}
        <button
          type="button"
          onClick={() => handleSocialLogin('kakao')}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-neutral-950"
        >
          {loading === 'kakao' ? (
            <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-600 dark:border-t-neutral-300 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FEE500">
              <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z" />
            </svg>
          )}
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            카카오
          </span>
        </button>
      </div>
    </div>
  );
}

