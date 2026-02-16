'use client';

import React from 'react';
import { Zap } from 'lucide-react';

const ROWS: { feature: string; competitor: string; us: string; highlight?: boolean; withZap?: boolean }[] = [
  { feature: '예약 방식', competitor: '단순 시간 선택 (헬스장형)', us: '캘린더형 클래스 선택 + 잔여석 실시간 확인', highlight: true },
  { feature: '결제 흐름', competitor: '예약 후 별도 창에서 결제 (이탈 발생)', us: '예약과 동시에 인앱 원클릭 결제', highlight: true, withZap: true },
  { feature: '콘텐츠 관리', competitor: '기능 없음 (카톡/유튜브 별도 공유)', us: '수업 직후 앱 내 영상 업로드 및 알림' },
  { feature: '출석 체크', competitor: '수기 또는 번호 입력', us: 'QR 코드 1초 태깅 & 부모님 안심 알림', highlight: true },
  { feature: '재등록 유도', competitor: '직접 전화/문자 돌리기', us: '수강권 만료 전 자동 푸시 & 할인 쿠폰 발송', highlight: true },
];

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm">
      <div className="grid grid-cols-3 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="p-4 sm:p-6 text-center font-bold text-neutral-600 dark:text-neutral-400 text-sm">구분</div>
        <div className="p-4 sm:p-6 text-center font-bold text-neutral-600 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700 text-sm">기존 피트니스 플랫폼</div>
        <div className="p-4 sm:p-6 text-center font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20 border-l border-neutral-200 dark:border-neutral-700 text-sm">무빗</div>
      </div>
      {ROWS.map((row, idx) => (
        <div
          key={idx}
          className="grid grid-cols-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors"
        >
          <div className="p-4 sm:p-6 flex items-center justify-center font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-50/50 dark:bg-neutral-800/30 text-center text-sm">
            {row.feature}
          </div>
          <div className="p-4 sm:p-6 flex items-center justify-center text-neutral-500 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-700 text-center text-xs sm:text-sm">
            {row.competitor}
          </div>
          <div className={`p-4 sm:p-6 flex items-center justify-center border-l border-neutral-200 dark:border-neutral-700 text-center text-xs sm:text-sm font-medium ${row.highlight ? 'text-blue-600 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-900/10' : 'text-neutral-700 dark:text-neutral-300'}`}>
            {row.withZap ? (
              <span className="flex items-center gap-2 justify-center flex-wrap">
                <Zap size={16} className="flex-shrink-0 text-blue-600 dark:text-blue-400" />
                {row.us}
              </span>
            ) : (
              row.us
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
