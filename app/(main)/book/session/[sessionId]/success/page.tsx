"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Home, Calendar, ArrowRight, UserPlus, Receipt } from 'lucide-react';
import { Suspense } from 'react';
import { formatBookingCode } from '@/lib/utils/booking-code';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'guest';
  const name = searchParams.get('name') || '';
  const email = searchParams.get('email') || '';
  const phone = searchParams.get('phone') || '';
  // B-4: 예약번호(toss orderId 또는 booking.id) — 비회원이 본인 거래 식별용.
  const orderId = searchParams.get('orderId') || '';
  // B-3: 비회원 카드결제는 type=purchase + guest=1 조합으로 전달됨.
  const isGuestPaid = type === 'purchase' && searchParams.get('guest') === '1';
  const isGuestOnsite = type === 'guest';
  const showGuestCTA = isGuestOnsite || isGuestPaid;

  // 프리필이 붙은 가입 링크 생성
  const signupHref = (() => {
    const qs = new URLSearchParams();
    qs.set('tab', 'signup');
    if (email) qs.set('email', email);
    if (name) qs.set('name', name);
    if (phone) qs.set('phone', phone);
    return `/my?${qs.toString()}`;
  })();

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

      {isGuestOnsite ? (
        <div className="text-center space-y-2 mb-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            {name && <span className="font-medium text-black dark:text-white">{name}</span>}님의 예약이 접수되었습니다.
          </p>
          <p className="text-sm text-neutral-500">
            수업 시작 전까지 현장에서 결제해주세요.
          </p>
        </div>
      ) : isGuestPaid ? (
        <div className="text-center space-y-2 mb-8">
          <p className="text-neutral-600 dark:text-neutral-400">
            {name && <span className="font-medium text-black dark:text-white">{name}</span>}님, 결제가 완료되었어요.
          </p>
          <p className="text-sm text-neutral-500">
            수업 시간에 맞춰 방문해주세요.
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

      {/* B-4 (2026-04-27): 예약번호(단축 코드) — 비회원이 본인 거래 식별·문의 시 사용 */}
      {showGuestCTA && orderId && (
        <div className="w-full max-w-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <Receipt size={18} className="text-neutral-500 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-0.5">예약번호</p>
              <p className="font-mono text-sm font-semibold text-black dark:text-white tracking-wider">
                {formatBookingCode(orderId)}
              </p>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.navigator?.clipboard) {
                  window.navigator.clipboard.writeText(formatBookingCode(orderId)).catch(() => {});
                }
              }}
              className="text-xs text-neutral-500 hover:text-black dark:hover:text-white px-2 py-1"
              aria-label="예약번호 복사"
            >
              복사
            </button>
          </div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2">
            학원에 문의하실 때 이 번호를 알려주세요.
          </p>
        </div>
      )}

      {/* B-4 (2026-04-27): 회원가입 메리트 정직 표현 — "더 저렴" 폐기,
          예약 조회·자동 추적·빠른 신청을 강조 */}
      {showGuestCTA && (
        <div className="w-full max-w-sm bg-primary/10 border border-primary/30 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <UserPlus size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-black dark:text-white text-sm mb-2">
                회원가입하면 이런 게 편해져요
              </h3>
              <ul className="text-xs text-neutral-600 dark:text-neutral-400 mb-3 space-y-1 list-disc list-inside">
                <li>내 예약을 한 곳에서 한눈에 확인</li>
                <li>출결·잔여 횟수가 자동으로 추적</li>
                <li>다음 신청은 정보 입력 없이 한 번에</li>
                <li>학원 새 일정·이벤트 알림을 받을 수 있어요</li>
              </ul>
              <button
                onClick={() => router.push(signupHref)}
                className="px-4 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all"
              >
                회원가입하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 안내 카드 */}
      <div className="w-full max-w-sm bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-5 mb-8 border border-neutral-200 dark:border-neutral-800">
        <h3 className="font-bold text-black dark:text-white mb-3">📌 안내사항</h3>
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-0.5 text-primary flex-shrink-0" />
            <span>수업 10분 전까지 도착해주세요.</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight size={16} className="mt-0.5 text-primary flex-shrink-0" />
            <span>편한 복장과 실내용 운동화를 준비해주세요.</span>
          </li>
          {showGuestCTA && (
            <li className="flex items-start gap-2">
              <ArrowRight size={16} className="mt-0.5 text-primary flex-shrink-0" />
              <span>예약 취소는 학원에 직접 문의해주세요.</span>
            </li>
          )}
        </ul>
      </div>

      {/* 버튼들 */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => router.push('/home')}
          className="w-full bg-primary text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
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
