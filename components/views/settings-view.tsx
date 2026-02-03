"use client";

import { ChevronLeft, User, Bell, Moon, Shield, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { useLocale, Language } from '@/contexts/LocaleContext';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView = ({ onBack }: SettingsViewProps) => {
  const { language, setLanguage, t } = useLocale();
  const [userName, setUserName] = useState('사용자');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 인증 기능 제거로 인해 기본값 설정
    setUserName('사용자');
    setUserEmail('');
    setLoading(false);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
            <ChevronLeft />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">{t('settings.title')}</h2>
        </div>
        <div className="text-center py-12 text-neutral-500">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen pt-12 px-5 pb-24 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-black dark:text-white">
          <ChevronLeft />
        </button>
        <h2 className="text-xl font-bold text-black dark:text-white">{t('settings.title')}</h2>
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
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">{t('settings.account')}</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <User className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.editProfile')}</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.privacy')}</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
      </div>

      {/* 알림 설정 */}
      <div className="space-y-1 mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">{t('settings.notification')}</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Bell className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.notificationSettings')}</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Moon className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.darkMode')}</span>
          </div>
          <ThemeToggle />
        </div>
        {/* 언어 설정 */}
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="text-neutral-600 dark:text-neutral-400" size={20} />
              <span className="text-sm font-bold text-black dark:text-white">{t('settings.language')}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleLanguageChange('ko')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                language === 'ko'
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {t('settings.languageKo')}
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                language === 'en'
                  ? 'bg-primary dark:bg-[#CCFF00] text-black'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {t('settings.languageEn')}
            </button>
          </div>
        </div>
      </div>

      {/* 기타 */}
      <div className="space-y-1 mb-6">
        <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 px-1">{t('settings.other')}</h3>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.terms')}</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.privacyPolicy')}</span>
          </div>
          <ChevronLeft className="rotate-180 text-neutral-400" size={16} />
        </button>
        <button className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left flex items-center justify-between active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-3">
            <Shield className="text-neutral-600 dark:text-neutral-400" size={20} />
            <span className="text-sm font-bold text-black dark:text-white">{t('settings.version')}</span>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">1.0.0</span>
        </button>
      </div>

    </div>
  );
};





