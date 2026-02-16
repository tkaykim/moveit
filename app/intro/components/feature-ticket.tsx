'use client';

import React, { useState } from 'react';
import { Ticket, Calendar, CheckCircle2 } from 'lucide-react';

export function FeatureTicket() {
  const [count, setCount] = useState(8);
  const [isBooking, setIsBooking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleBook = () => {
    if (count <= 0) return;
    setIsBooking(true);
    setTimeout(() => {
      setIsBooking(false);
      setCount(prev => prev - 1);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }, 800);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm relative">
      <div className="p-4 bg-neutral-900 text-white dark:bg-[#CCFF00] dark:text-black">
        <div className="flex justify-between items-start">
          <div>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 dark:bg-black/10 mb-2">
              쿠폰제
            </span>
            <h3 className="text-lg font-bold leading-tight">20회 쿠폰</h3>
            <p className="text-xs opacity-70 mt-1">2025.12.31 까지</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{count}<span className="text-sm font-normal opacity-70">회</span></div>
            <p className="text-[10px] opacity-70">남음</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-neutral-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 dark:text-white">오늘 수업 예약</p>
            <p className="text-xs text-neutral-500">19:00 • 걸스힙합</p>
          </div>
        </div>

        <button
          onClick={handleBook}
          disabled={isBooking || count <= 0}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            isBooking 
              ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
              : 'bg-neutral-900 text-white dark:bg-[#CCFF00] dark:text-black hover:opacity-90 active:scale-[0.98]'
          }`}
        >
          {isBooking ? '처리중...' : '1회 차감하고 예약하기'}
        </button>
      </div>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="absolute inset-0 bg-white/90 dark:bg-neutral-900/90 flex flex-col items-center justify-center animate-in fade-in duration-200">
          <CheckCircle2 className="w-10 h-10 text-green-500 mb-2 animate-in zoom-in duration-300" />
          <p className="text-sm font-bold text-neutral-900 dark:text-white">예약 완료!</p>
          <p className="text-xs text-neutral-500">잔여 횟수가 차감되었습니다.</p>
        </div>
      )}
    </div>
  );
}
