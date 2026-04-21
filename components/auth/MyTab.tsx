"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { X } from 'lucide-react';

interface MyTabProps {
  isOpen: boolean;
  onClose: () => void;
  /** 모달을 열 때 보여줄 탭. 미지정 시 로그인 */
  initialTab?: 'login' | 'signup';
  /** B-3: 비회원 결제 후 가입 유도 시 이메일·이름·전화 프리필 */
  initialEmail?: string;
  initialName?: string;
  initialPhone?: string;
}

export function MyTab({ isOpen, onClose, initialTab = 'login', initialEmail, initialName, initialPhone }: MyTabProps) {
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

  const { signIn, signUp } = useAuth();

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
        onClose();
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
        onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
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

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
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
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="이메일을 입력하세요"
                required
              />
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




