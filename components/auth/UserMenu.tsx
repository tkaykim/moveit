"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  if (!user || !profile) {
    return null;
  }

  const displayName = profile.nickname || profile.name || profile.email || '사용자';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="text-black dark:text-white" size={16} />
            )}
          </div>
        </div>
        <span className="text-sm font-medium text-black dark:text-white hidden sm:block">
          {displayName}
        </span>
        <ChevronDown
          className={`text-neutral-500 dark:text-neutral-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          size={16}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <p className="text-sm font-bold text-black dark:text-white">{displayName}</p>
            {profile.email && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {profile.email}
              </p>
            )}
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                router.push('/settings');
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              설정
            </button>
            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


