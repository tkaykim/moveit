'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, Ticket, Video, UserCheck2, Clock, MessageSquare, Check } from 'lucide-react';

const NOTIFICATIONS = [
  {
    id: 'expiry',
    icon: Ticket,
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    title: '수강권 만료 임박 (D-3)',
    body: '무빗 스튜디오 20회 쿠폰이 3일 후 만료됩니다. 남은 횟수: 5회. 서둘러 사용하세요!',
    time: '오전 9:00',
    category: '자동발송',
    categoryColor: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  },
  {
    id: 'attendance',
    icon: UserCheck2,
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: '출석 체크 완료',
    body: '무빗 스튜디오 K-POP 입문 출석이 확인되었습니다. 2/17 오후 6:00',
    time: '오후 6:01',
    category: '출석알림',
    categoryColor: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  },
  {
    id: 'video',
    icon: Video,
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    title: '수업 영상이 등록되었습니다',
    body: '2/17 무빗 스튜디오 걸스힙합 수업 영상이 업로드되었습니다. 지금 확인해보세요!',
    time: '오후 10:30',
    category: '영상알림',
    categoryColor: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  },
  {
    id: 'reminder',
    icon: Clock,
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: '오늘 수업이 있어요!',
    body: '오후 7:30 무빗 스튜디오 코레오그래피 수업이 예정되어 있습니다. 준비물을 확인해주세요!',
    time: '오전 10:00',
    category: '수업리마인드',
    categoryColor: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  },
  {
    id: 'booking',
    icon: Calendar,
    color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
    title: '예약 완료',
    body: '무빗 스튜디오 K-POP 입문 수업이 예약되었습니다. 2/18 오후 6:00',
    time: '방금',
    category: '예약알림',
    categoryColor: 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300',
  },
];

export function FeaturePush() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = () => {
    setVisibleCount(0);
    setIsPlaying(true);
    
    let count = 0;
    const showNext = () => {
      count++;
      setVisibleCount(count);
      if (count < NOTIFICATIONS.length) {
        timeoutRef.current = setTimeout(showNext, 900);
      } else {
        setIsPlaying(false);
      }
    };
    timeoutRef.current = setTimeout(showNext, 600);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-neutral-900 dark:text-[#CCFF00]" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">스마트 알림</h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#CCFF00]/20 text-[#aacc00] dark:text-[#CCFF00] font-bold">
            자동 발송
          </span>
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          만료 알림, 출석 확인, 영상 등록, 수업 리마인드까지<br/>
          모두 자동으로 푸시 알림이 발송됩니다.
        </p>
      </div>

      {/* Notification List */}
      <div className="p-3 space-y-2 min-h-[200px]">
        {visibleCount === 0 && !isPlaying && (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">아래 버튼을 눌러 알림을 체험해보세요</p>
          </div>
        )}
        {NOTIFICATIONS.slice(0, visibleCount).map((noti, idx) => {
          const Icon = noti.icon;
          return (
            <div
              key={noti.id}
              className="flex gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 animate-in slide-in-from-right duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`w-9 h-9 rounded-lg ${noti.color} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">{noti.title}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${noti.categoryColor} flex-shrink-0`}>
                    {noti.category}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug line-clamp-2">{noti.body}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{noti.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action */}
      <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={startAnimation}
          disabled={isPlaying}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            isPlaying 
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              : 'bg-neutral-900 dark:bg-[#CCFF00] text-white dark:text-black hover:opacity-90 active:scale-[0.98]'
          }`}
        >
          {isPlaying ? '알림 발송 중...' : visibleCount > 0 ? '다시 체험하기' : '알림 발송 시뮬레이션'}
        </button>
      </div>
    </div>
  );
}
