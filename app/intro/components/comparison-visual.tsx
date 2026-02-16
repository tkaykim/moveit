'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';

const ROWS = [
  { name: '수강권 관리', health: '단순 기간/횟수', moveit: '클래스별 차감, 양도, 홀딩' },
  { name: '출석 체크', health: '입장 시 체크', moveit: '수업별 강사 직접 체크' },
  { name: '스케줄', health: '고정 시간표', moveit: '변동 스케줄, 대강 관리' },
  { name: '커뮤니티', health: '불가', moveit: '영상 공유, 공지사항' },
];

export function ComparisonVisual() {
  return (
    <div className="w-full max-w-4xl mx-auto px-1">
      {/* 항상 가로 한 줄: 헬스 vs 무빗 나란히 비교 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
        {/* 헬스/필라테스 카드 */}
        <div className="rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 bg-neutral-800/60 border border-neutral-700/60 min-w-0">
          <p className="text-center text-neutral-500 text-xs sm:text-sm font-semibold mb-3 sm:mb-5 truncate">헬스/필라테스</p>
          <div className="space-y-2 sm:space-y-4">
            {ROWS.map((row, idx) => (
              <div key={idx} className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-neutral-700 flex items-center justify-center">
                  <Minus size={12} className="text-neutral-500" />
                </span>
                <div className="min-w-0">
                  <p className="text-neutral-500 text-[10px] sm:text-xs font-medium mb-0.5">{row.name}</p>
                  <p className="text-neutral-400 text-[11px] sm:text-sm leading-tight">{row.health}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 무빗 카드 - 강조 */}
        <div className="relative rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 overflow-hidden border-2 border-[#CCFF00]/40 bg-gradient-to-b from-[#CCFF00]/15 to-[#CCFF00]/5 shadow-[0_0_40px_-12px_rgba(204,255,0,0.35)] min-w-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <p className="relative text-center text-[#CCFF00] text-xs sm:text-sm font-bold mb-3 sm:mb-5">무빗</p>
          <div className="relative space-y-2 sm:space-y-4">
            {ROWS.map((row, idx) => (
              <div key={idx} className="flex items-start gap-2 sm:gap-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#CCFF00]/25 flex items-center justify-center">
                  <Check size={12} className="text-[#CCFF00]" />
                </span>
                <div className="min-w-0">
                  <p className="text-neutral-400 text-[10px] sm:text-xs font-medium mb-0.5">{row.name}</p>
                  <p className="text-white text-[11px] sm:text-sm font-medium leading-tight">{row.moveit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
