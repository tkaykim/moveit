"use client";

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';

// B-4 (2026-04-27): Google OAuth는 환경변수 가드. 콘솔 미설정 시 버튼 숨김.
const GOOGLE_OAUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_OAUTH === 'true';

interface MyTabProps {
  isOpen: boolean;
  onClose: () => void;
  /** 모달을 열 때 보여줄 탭. 미지정 시 로그인 */
  initialTab?: 'login' | 'signup';
  /** B-3: 비회원 결제 후 가입 유도 시 이메일·이름·전화 프리필 */
  initialEmail?: string;
  initialName?: string;
  initialPhone?: string;
  /** 2026-05-10: 비회원 결제 시 입력한 이메일/전화가 정식 회원과 충돌해 로그인을 유도할 때
   *  모달 상단에 명확한 안내문을 띄우는 prop. 빈 값이면 노출 안 함. */
  conflictNotice?: string;
  /** 2026-05-10: 충돌 흐름에서 이메일이 이미 결정돼 있어 사용자가 다시 입력하면 안 되는 경우
   *  email input을 readonly + 시각적으로 잠금 상태로 표시. */
  lockEmail?: boolean;
  /** 2026-05-10: 로그인/회원가입 성공 시 호출. 부모가 onClose(=취소/dismiss)와 구분해
   *  자동 재진입 등 후속 액션을 결정할 수 있게 함. 미지정이면 onClose 만 호출. */
  onAuthSuccess?: () => void;
}

export function MyTab({ isOpen, onClose, initialTab = 'login', initialEmail, initialName, initialPhone, conflictNotice, lockEmail, onAuthSuccess }: MyTabProps) {
  const [isLogin, setIsLogin] = useState(initialTab === 'login');

  useEffect(() => {
    if (isOpen) {
      setIsLogin(initialTab === 'login');
    }
  }, [isOpen, initialTab]);
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(initialName ?? '');
  const [phone, setPhone] = useState(initialPhone ?? '');

  // B-3: 초기값 prop 변경 시 입력값 반영 (모달 재오픈 시나리오)
  useEffect(() => {
    if (isOpen) {
      if (initialEmail !== undefined) setEmail(initialEmail);
      if (initialName !== undefined) setName(initialName);
      if (initialPhone !== undefined) setPhone(initialPhone);
    }
  }, [isOpen, initialEmail, initialName, initialPhone]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // B-4 (2026-04-27): 결제 흐름 도중 진입했을 때 OAuth 후 같은 페이지로 복귀.
  // searchParams가 있으면 query까지 포함해 returnTo 구성.
  const returnTo = (() => {
    if (typeof window === 'undefined') return undefined;
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname || '/home';
  })();

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(returnTo);
      if (error) {
        setError((error as any)?.message || 'Google 로그인에 실패했습니다.');
        setLoading(false);
      }
      // 성공 시 OAuth redirect → 페이지 이탈, loading 유지로 깜빡임 최소화
    } catch (err: any) {
      setError(err?.message || 'Google 로그인 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      setLoading(false);
      return;
    }

    try {
      // 30초 타임아웃
      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: '로그인 요청 시간이 초과되었습니다. 다시 시도해주세요.' } }), 30000)
      );
      const result = await Promise.race([signIn(email, password), timeoutPromise]);

      if (result.error) {
        setError(result.error.message || '로그인에 실패했습니다.');
      } else {
        if (onAuthSuccess) onAuthSuccess(); else onClose();
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // P0-3 (2026-04-20): Phone is now optional to allow foreigners without a KR phone number
    // to sign up with email only.
    if (!email || !password || !name) {
      setError('이메일, 비밀번호, 이름을 입력해주세요.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      // 30초 타임아웃
      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: '회원가입 요청 시간이 초과되었습니다. 다시 시도해주세요.' } }), 30000)
      );
      const trimmedPhone = phone.trim();
      const result = await Promise.race([
        signUp(email, password, name, undefined, trimmedPhone || undefined, undefined),
        timeoutPromise,
      ]);

      if (result.error) {
        const message = result.error.message || '회원가입에 실패했습니다.';
        setError(message);
        // P0-2: On "already registered" outcomes, switch to login tab automatically so users
        // can recover without re-entering the form.
        const code = (result.error as any)?.code;
        if (code === 'ALREADY_REGISTERED' || /이미 가입/.test(message)) {
          setIsLogin(true);
          setPassword('');
        }
      } else {
        if (onAuthSuccess) onAuthSuccess(); else onClose();
        setEmail('');
        setPassword('');
        setName('');
        setPhone('');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // B-4 (2026-04-27): 중앙정렬 → 하단 시트로 변경. 모바일 표준 패턴 + 시선 추적 명확.
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black dark:text-white">
            {isLogin ? '로그인' : '회원가입'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="text-neutral-600 dark:text-neutral-400" size={20} />
          </button>
        </div>

        {/* 2026-05-10: 회원 충돌 안내 — 비회원 결제 진입 시 이메일/전화가 정식 회원과
            충돌하면 부모가 conflictNotice 로 사유를 전달. 사용자가 본인이 가입된 줄 모르는
            상태에서 즉시 인지하고 비밀번호만 입력하면 결제 흐름이 자동 재진입되도록 안내. */}
        {conflictNotice && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">{conflictNotice}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* B-4: Google OAuth 메인 버튼 + OR divider. flag OFF면 숨김. */}
        {GOOGLE_OAUTH_ENABLED && (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 mb-3 bg-white dark:bg-neutral-100 text-black border border-neutral-300 dark:border-neutral-300 rounded-lg font-semibold hover:bg-neutral-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Google로 계속하기"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 계속하기
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              <span className="text-xs text-neutral-400">또는 이메일로</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </>
        )}

        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { if (!lockEmail) setEmail(e.target.value); }}
                readOnly={lockEmail}
                className={`w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary ${lockEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                placeholder="이메일을 입력하세요"
                required
              />
              {lockEmail && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  결제 진행 중 입력한 이메일로 로그인합니다.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="비밀번호를 입력하세요"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-lg font-bold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setError(null);
              }}
              className="w-full py-3 text-neutral-600 dark:text-neutral-400 text-sm"
            >
              계정이 없으신가요? <span className="font-bold text-black dark:text-white">회원가입</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                이메일 *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="이메일을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                비밀번호 * (최소 6자)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="비밀번호를 입력하세요"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="이름을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                전화번호 (선택)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="전화번호를 입력하세요 (예: 010-0000-0000)"
              />
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                전화번호가 없으면 이메일만으로도 가입할 수 있어요.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black rounded-lg font-bold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '회원가입 중...' : '회원가입'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setError(null);
              }}
              className="w-full py-3 text-neutral-600 dark:text-neutral-400 text-sm"
            >
              이미 계정이 있으신가요? <span className="font-bold text-black dark:text-white">로그인</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}




