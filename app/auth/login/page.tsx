'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 입력 검증
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      setLoading(false);
      return;
    }

    if (!password) {
      setError('비밀번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        // 에러 메시지 한글화
        let errorMessage = authError.message;
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('invalid')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (authError.message.includes('Email not confirmed') || authError.message.includes('not confirmed')) {
          errorMessage = '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
        } else if (authError.message.includes('User not found')) {
          errorMessage = '등록되지 않은 이메일입니다.';
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // 로그인 성공 확인
      if (data.session && data.user) {
        // 세션 저장 확인
        const { data: { session: confirmedSession } } = await supabase.auth.getSession();
        
        if (confirmedSession) {
          const redirectTo = searchParams.get('redirect') || '/admin';
          // 리다이렉트
          router.push(redirectTo);
          router.refresh();
        } else {
          // 세션이 저장되지 않은 경우 - 강제 리다이렉트로 재시도
          const redirectTo = searchParams.get('redirect') || '/admin';
          window.location.href = redirectTo;
        }
      } else {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('로그인 오류:', err);
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-lg p-8 border border-neutral-200 dark:border-neutral-900">
          <h1 className="text-3xl font-bold text-center mb-8 text-neutral-900 dark:text-white">
            로그인
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <SocialLoginButtons redirectTo={searchParams.get('redirect') || '/admin'} />

          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              계정이 없으신가요?{' '}
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                회원가입
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/" className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black">
        <div className="text-neutral-600 dark:text-neutral-400">로딩 중...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

