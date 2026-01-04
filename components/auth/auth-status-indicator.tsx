'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { User, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * 간단한 인증 상태 표시 컴포넌트
 * 로그인 상태에 따라 다른 UI를 보여줍니다.
 */
export function AuthStatusIndicator() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500">
        <div className="w-4 h-4 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">로딩 중...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push('/auth/login')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-primary dark:hover:text-[#CCFF00] transition-colors"
      >
        <LogIn size={16} />
        <span>로그인하세요</span>
      </button>
    );
  }

  const displayName = profile?.name || profile?.nickname || user.email?.split('@')[0] || '사용자';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
      <User size={16} className="text-primary dark:text-[#CCFF00]" />
      <span className="font-medium text-black dark:text-white">{displayName}</span>
    </div>
  );
}

