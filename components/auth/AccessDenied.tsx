"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldX, Home, LogIn } from 'lucide-react';
import { AdminLoginModal } from './AdminLoginModal';

interface AccessDeniedProps {
  /** 로그인 되어 있지만 권한이 없는 경우 true */
  isLoggedIn?: boolean;
  /** 로그인 성공 후 호출 (페이지 새로고침 등) */
  onLoginSuccess?: () => void;
  /** 커스텀 메시지 */
  message?: string;
}

export function AccessDenied({ isLoggedIn = false, onLoginSuccess, message }: AccessDeniedProps) {
  const router = useRouter();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const defaultMessage = isLoggedIn
    ? '이 페이지에 접근할 권한이 없습니다.'
    : '이 페이지에 접근하려면 로그인이 필요합니다.';

  return (
    <>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <ShieldX className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            접근 권한 없음
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            {message || defaultMessage}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push('/')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium"
            >
              <Home size={18} />
              홈으로
            </button>
            <button
              onClick={() => setLoginModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors font-medium"
            >
              <LogIn size={18} />
              {isLoggedIn ? '다른 계정으로 로그인' : '로그인하기'}
            </button>
          </div>
        </div>
      </div>

      <AdminLoginModal
        isOpen={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          // 로그인 성공 시 권한 재검사를 위해 콜백 호출
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        }}
      />
    </>
  );
}
