'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccess(false);
    setNeedsEmailVerification(false);

    // 입력 검증
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim() || null,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/admin`,
        },
      });

      if (authError) {
        // 에러 메시지 한글화
        let errorMessage = authError.message;
        if (authError.message.includes('already registered')) {
          errorMessage = '이미 등록된 이메일입니다.';
        } else if (authError.message.includes('Invalid email')) {
          errorMessage = '유효하지 않은 이메일 형식입니다.';
        } else if (authError.message.includes('Password')) {
          errorMessage = '비밀번호가 너무 짧습니다.';
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // 회원가입 성공
      // handle_new_user() 트리거가 자동으로 public.users 테이블에 프로필을 생성합니다.
      
      // 이메일 인증이 필요한 경우
      if (authData.user && !authData.session) {
        setNeedsEmailVerification(true);
        setSuccess(true);
      } else if (authData.session && authData.user) {
        // 이메일 인증이 필요 없는 경우 (설정에 따라)
        setSuccess(true);
        // 로그인 성공 - 리다이렉트
        router.push('/admin');
        router.refresh();
      } else {
        setError('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error('회원가입 오류:', err);
      setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-black px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-lg p-8 border border-neutral-200 dark:border-neutral-900">
          <h1 className="text-3xl font-bold text-center mb-8 text-neutral-900 dark:text-white">
            회원가입
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && needsEmailVerification && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded">
                <p className="font-semibold mb-1">이메일 인증이 필요합니다</p>
                <p className="text-sm">
                  {email}로 인증 링크를 보냈습니다. 이메일을 확인하고 링크를 클릭해주세요.
                </p>
              </div>
            )}

            {success && !needsEmailVerification && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
                회원가입이 완료되었습니다!
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                placeholder="홍길동"
              />
            </div>

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
              <p className="mt-1 text-xs text-neutral-500">최소 6자 이상</p>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '가입 중...' : success ? '가입 완료' : '회원가입'}
            </button>
          </form>

          {success && needsEmailVerification && (
            <div className="mt-4 text-center">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                이메일을 받지 못하셨나요?
              </p>
              <button
                type="button"
                onClick={async () => {
                  const supabase = createClient();
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: email.trim().toLowerCase(),
                    options: {
                      emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/admin`,
                    },
                  });
                  if (error) {
                    setError('이메일 재전송 중 오류가 발생했습니다.');
                  } else {
                    setError('');
                    alert('인증 이메일을 다시 보냈습니다.');
                  }
                }}
                className="text-sm text-primary hover:underline font-medium"
              >
                인증 이메일 다시 보내기
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              이미 계정이 있으신가요?{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                로그인
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

