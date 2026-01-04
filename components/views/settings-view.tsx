"use client";

import { ChevronLeft, User, Bell, Moon, Sun, Shield, LogOut, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { useRouter } from 'next/navigation';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView = ({ onBack }: SettingsViewProps) => {
  const [userName, setUserName] = useState('사용자');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUserData() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: userProfile } = await (supabase as any)
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userProfile) {
          setUserName(userProfile.name || userProfile.nickname || '사용자');
          setUserEmail(user.email || '');
        } else {
          setUserName(user.email?.split('@')[0] || '사용자');
          setUserEmail(user.email || '');
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, []);

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
        router.push('/auth/login');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">설정</h2>
        </div>
        <div className="text-center py-12 text-neutral-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">설정</h2>
      </div>

      {/* 프로필 정보 */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
              <User className="text-black dark:text-white" size={20} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-black dark:text-white">{userName}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{userEmail}</div>
          </div>
        </div>
      </div>

      {/* 계정 설정 */}
      <div className="space-y-1 mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">계정</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <User className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">프로필 수정</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">개인정보 보호</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
      </div>

      {/* 알림 설정 */}
      <div className="space-y-1 mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">알림</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Bell className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">알림 설정</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">다크 모드</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* 기타 */}
      <div className="space-y-1 mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">기타</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">이용약관</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">개인정보 처리방침</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">버전 정보</span>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">1.0.0</span>
        </button>
      </div>

      {/* 로그아웃 및 계정 삭제 */}
      <div className="space-y-1 mb-6">
        <button
          onClick={handleLogout}
          className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <LogOut className="text-red-500" size={20} />
          <span className="text-sm font-bold text-red-500">로그아웃</span>
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-red-500/20 dark:border-red-500/20 rounded-2xl p-4 text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
          <Trash2 className="text-red-500" size={20} />
          <span className="text-sm font-bold text-red-500">계정 삭제</span>
        </button>
      </div>
    </div>
  );
};



