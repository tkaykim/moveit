'use client';

import { useState } from 'react';
import { SignupModal } from '@/components/auth/signup-modal';
import { LoginModal } from '@/components/auth/login-modal';
import { AuthTestLogger } from '@/components/auth/auth-test-logger';

export default function LoginTestPage() {
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            인증 테스트 페이지
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            회원가입과 로그인 기능을 테스트하고 모든 로그를 확인할 수 있습니다.
            같은 동작을 5번 이상 반복하면 오류로 판단됩니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 컨트롤 패널 */}
          <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-lg p-6 border border-neutral-200 dark:border-neutral-900">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              테스트 컨트롤
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => setIsSignupModalOpen(true)}
                className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                회원가입 테스트
              </button>

              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                로그인 테스트
              </button>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  테스트 안내
                </h3>
                <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
                  <li>• 회원가입 또는 로그인을 여러 번 시도해보세요</li>
                  <li>• 모든 동작이 로그에 기록됩니다</li>
                  <li>• 같은 동작을 5번 이상 반복하면 오류로 표시됩니다</li>
                  <li>• 오른쪽 패널에서 실시간 로그를 확인할 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 로그 패널 */}
          <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-lg p-6 border border-neutral-200 dark:border-neutral-900">
            <div className="h-[600px]">
              <AuthTestLogger />
            </div>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
      />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}

