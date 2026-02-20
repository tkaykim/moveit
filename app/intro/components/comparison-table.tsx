'use client';

import React from 'react';
import { Zap } from 'lucide-react';

// 줄바꿈이 자연스러우도록 짧은 워딩·구분자(·) 사용
const ROWS: { feature: string; competitor: string; us: string; highlight?: boolean; withZap?: boolean }[] = [
  { feature: '예약 방식', competitor: '단순 시간 선택, 헬스장형', us: '캘린더형 클래스 선택 · 잔여석 실시간 확인', highlight: true },
  { feature: '결제 흐름', competitor: '예약 후 별도 창 결제로 이탈 발생', us: '예약과 동시에 인앱 원클릭 결제', highlight: true, withZap: true },
  { feature: '콘텐츠 관리', competitor: '기능 없음. 카톡·유튜브 별도 공유', us: '수업 직후 앱 내 영상 업로드·알림' },
  { feature: '출석 체크', competitor: '수기 또는 번호 입력', us: 'QR 1초 태깅 · 부모님 안심 알림', highlight: true },
  { feature: '재등록 유도', competitor: '직접 전화·문자 돌리기', us: '만료 전 자동 푸시 · 할인 쿠폰 발송', highlight: true },
];

type ComparisonTableProps = { isLight?: boolean };

export function ComparisonTable({ isLight = true }: ComparisonTableProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border shadow-sm ${isLight ? 'border-neutral-200 bg-white' : 'border-neutral-700 bg-neutral-900'}`}>
      {/* 구분 열: 한 단어가 잘리지 않도록 최소 너비 확보, 나머지 두 열은 동일 비율 */}
      <div className={`grid border-b ${isLight ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-700 bg-neutral-800/50'}`} style={{ gridTemplateColumns: 'minmax(100px, auto) 1fr 1fr' }}>
        <div className={`py-3 px-2 sm:px-3 text-center font-bold text-xs sm:text-sm whitespace-nowrap ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>구분</div>
        <div className={`py-3 px-3 sm:px-5 text-center font-bold border-l text-xs sm:text-sm ${isLight ? 'text-neutral-600 border-neutral-200' : 'text-neutral-400 border-neutral-700'}`}>기존 피트니스 플랫폼</div>
        <div className={`py-3 px-3 sm:px-5 text-center font-bold border-l text-xs sm:text-sm ${isLight ? 'text-blue-800 bg-blue-100 border-neutral-200' : 'text-blue-400 bg-blue-900/20 border-neutral-700'}`}>무빗</div>
      </div>
      {ROWS.map((row, idx) => (
        <div
          key={idx}
          className={`grid border-b last:border-0 transition-colors ${isLight ? 'border-neutral-100 hover:bg-neutral-50/50' : 'border-neutral-800 hover:bg-neutral-800/30'}`}
          style={{ gridTemplateColumns: 'minmax(100px, auto) 1fr 1fr' }}
        >
          <div className={`py-3 px-2 sm:px-3 flex items-center justify-center font-semibold text-center text-xs sm:text-sm leading-tight whitespace-nowrap ${isLight ? 'text-neutral-700 bg-neutral-50/50' : 'text-neutral-300 bg-neutral-800/30'}`}>
            {row.feature}
          </div>
          <div className={`py-3 px-3 sm:px-5 flex items-center min-w-0 border-l text-xs sm:text-sm leading-snug ${isLight ? 'text-neutral-500 border-neutral-200' : 'text-neutral-400 border-neutral-700'}`}>
            {row.competitor}
          </div>
          <div className={`py-3 px-3 sm:px-5 flex items-center min-w-0 border-l text-xs sm:text-sm font-medium leading-snug ${isLight ? 'border-neutral-200' : 'border-neutral-700'} ${row.highlight ? (isLight ? 'text-blue-800 bg-blue-50' : 'text-blue-400 bg-blue-900/10') : (isLight ? 'text-neutral-700' : 'text-neutral-300')}`}>
            {row.withZap ? (
              <span className="inline-flex items-center gap-1.5 flex-wrap">
                <Zap size={14} className={`flex-shrink-0 ${isLight ? 'text-blue-800' : 'text-blue-400'}`} />
                <span>{row.us}</span>
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
