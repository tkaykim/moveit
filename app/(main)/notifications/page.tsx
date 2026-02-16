"use client";

import { ChevronLeft, Settings } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationList } from '@/components/notifications/notification-list';
import { NotificationSettings } from '@/components/notifications/notification-settings';

export default function NotificationsPage() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return <NotificationSettings onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="bg-white dark:bg-neutral-950 min-h-screen">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between px-5 pt-12 pb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-black dark:text-white"
            >
              <ChevronLeft />
            </button>
            <h1 className="text-xl font-bold text-black dark:text-white">알림</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-neutral-500 dark:text-neutral-400 active:opacity-70"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* 알림 목록 */}
      <NotificationList />
    </div>
  );
}
