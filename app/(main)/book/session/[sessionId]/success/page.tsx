"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Home, Calendar, ArrowRight } from 'lucide-react';
import { Suspense } from 'react';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'guest';
  const name = searchParams.get('name') || '';

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-6">
      {/* 성공 아이콘 */}
      <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
        <CheckCircle size={48} className="text-green-500" />
      </div>

      {/* 메시지 */}
      <h1 className="text-2xl font-black text-black dark:text-white mb-2 text-center">
        예약이 완료되었습니다!
      </h1>
      
      {type === 'guest' ? (
        <div className="text-center space-y-2 mb-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            {name && <span className="font-medium text-black dark:text-white">{name}</span>}님의 예약이 접수되었습니다.
          </p>
          <p className="text-sm text-neutral-500">
            수업 시작 전까지 현장에서 결제해주세요.
          </p>
        </div>
      ) : (
        <div className="text-center space-y-2 mb-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            수강권이 차감되었습니다.
          </p>
          <p className="text-sm text-neutral-500">
            수업 시간에 맞춰 방문해주세요!
          </p>
        </div>
      )}

      {/* 안내 카드 */}
      <div className="w-full max-w-sm bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 mb-8 border border-neutral-200 dark:border-neutral-800">
        <h3 className="font-bold text-black dark:text-white mb-3">📌 안내사항</h3>
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-0.5 text-primary dark:text-[#CCFF00] flex-shrink-0" />
            <span>수업 10분 전까지 도착해주세요.</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-0.5 text-primary dark:text-[#CCFF00] flex-shrink-0" />
            <span>편한 복장과 실내용 운동화를 준비해주세요.</span>
          </li>
          {type === 'guest' && (
            <li className="flex items-start gap-2">
              <ArrowRight size={16} className="mt-0.5 text-primary dark:text-[#CCFF00] flex-shrink-0" />
              <span>예약 취소는 학원에 직접 문의해주세요.</span>
            </li>
          )}
        </ul>
      </div>

      {/* 버튼들 */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => router.push('/home')}
          className="w-full bg-primary dark:bg-[#CCFF00] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Home size={20} />
          홈으로 이동
        </button>
        
        <button
          onClick={() => router.push('/schedule')}
          className="w-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
        >
          <Calendar size={20} />
          내 일정 보기
        </button>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950">
        <div className="text-neutral-500">로딩 중...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
