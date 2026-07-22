'use client';

/**
 * 수업 회차 딥링크 화면 (Task L)
 *
 * 한 회차만 집중해 보여준다: 수업명·강사·일시·홀·정원/잔여, 특별수업/멤버십 배지,
 * 그리고 예약 창 상태(오픈 전 / 마감 / 정원마감 / 휴강)에 따라 **정직한** CTA.
 *
 * 규율:
 *   ① 예약 가능하면 "신청하기" → 이 회차를 장바구니에 담고 결제(장바구니)로 보낸다.
 *      **별도 예약 경로를 만들지 않는다** — 기존 장바구니 + /api/orders 흐름을 그대로 탄다.
 *   ② 로그아웃 상태면 로그인으로 유도하되 **같은 회차로 되돌아온다**(return-to).
 *   ③ 화면은 서버(RLS·정책)가 준 판정만 그린다. 가림/오픈시각을 코드에서 지어내지 않는다.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, CalendarClock, MapPin, User2, Check, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { addToCart, readCart } from '@/lib/miniapp/cart';
import { CopyLinkButton } from '@/components/share/copy-link-button';
import { QuickJoinSheet } from '@/components/miniapp/quick-join-sheet';
import type { MiniOccurrence } from '@/lib/db/miniapp';
import type { MiniSkin } from '@/lib/miniapp/skin';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });

const fmtOpen = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  });

export function ClassLinkView({
  slug,
  academyId,
  academyName,
  skin,
  occurrence,
}: {
  slug: string;
  academyId: string;
  academyName: string;
  skin: MiniSkin | null;
  occurrence: MiniOccurrence | null;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [added, setAdded] = useState(false);
  const [selfUrl, setSelfUrl] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelfUrl(`${window.location.origin}/s/${slug}/c/${occurrence?.id ?? ''}`);
    }
  }, [slug, occurrence?.id]);

  useEffect(() => {
    if (!occurrence) return;
    const sync = () => {
      const ids = readCart(academyId)
        .map((e) => (e.item.item_type === 'SCHEDULE_BOOKING' ? e.item.schedule_id : null))
        .filter(Boolean) as string[];
      setAdded(ids.includes(occurrence.id));
    };
    sync();
    window.addEventListener('miniapp-cart-changed', sync);
    return () => window.removeEventListener('miniapp-cart-changed', sync);
  }, [academyId, occurrence]);

  // 찾을 수 없음 / 접근 권한 없음 — 둘을 구분하지 않는다(존재 유출 방지).
  if (!occurrence) {
    return (
      <div className="px-5 pt-16 pb-10 text-center" data-testid="class-not-found">
        <p className="text-[15px] font-bold">수업을 찾을 수 없습니다</p>
        <p className="text-[13px] text-neutral-500 mt-2 leading-relaxed">
          링크가 만료됐거나, 볼 수 있는 권한이 없는 수업입니다.
        </p>
        <Link
          href={`/s/${slug}/schedule`}
          className="inline-block mt-6 px-4 py-2 rounded-lg text-[12px] font-bold text-white"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          전체 시간표 보기
        </Link>
      </div>
    );
  }

  const o = occurrence;
  const remaining =
    typeof o.max_students === 'number' ? Math.max(0, o.max_students - o.booked_count) : null;

  // CTA 상태 판정 — 하나의 정직한 상태만 고른다.
  const state: 'CANCELED' | 'NOT_YET_OPEN' | 'CLOSED' | 'FULL' | 'BOOKABLE' = o.is_canceled
    ? 'CANCELED'
    : o.booking_state === 'NOT_YET_OPEN'
      ? 'NOT_YET_OPEN'
      : o.booking_state === 'CLOSED'
        ? 'CLOSED'
        : o.is_full
          ? 'FULL'
          : 'BOOKABLE';

  const handleBook = () => {
    addToCart(academyId, {
      label: o.title,
      sublabel: `${fmtTime(o.start_time)} · ${o.group_name ?? ''}`.trim(),
      item: { item_type: 'SCHEDULE_BOOKING', schedule_id: o.id, use_purchase_index: null },
    });
    router.push(`/s/${slug}/cart`);
  };

  const signInHref = `/s/${slug}/my?next=${encodeURIComponent(`/s/${slug}/c/${o.id}`)}`;

  return (
    <div
      className="px-5 pt-8 pb-10"
      data-testid="class-link"
      data-schedule-id={o.id}
      data-state={state}
      data-bookable={state === 'BOOKABLE' ? '1' : '0'}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <p
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: 'var(--primary)' }}
        >
          {skin?.heroEyebrow ?? 'Class'}
        </p>
        <CopyLinkButton url={selfUrl} testId="class-copy-link" ariaLabel="이 수업 링크 복사" />
      </div>

      <h1 data-testid="class-title" className="text-[22px] font-extrabold tracking-tight leading-snug break-keep">
        {o.title}
      </h1>

      {/* 배지 */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {o.group_name && (
          <span
            data-testid="class-group-badge"
            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          >
            {o.group_name}
          </span>
        )}
        {o.is_special && (
          <span
            data-testid="class-special-badge"
            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
          >
            특별수업 · 별도 결제
          </span>
        )}
        {o.is_audience_limited && (
          <span
            data-testid="class-audience-badge"
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
          >
            <Lock size={9} /> 멤버십 전용
          </span>
        )}
      </div>

      {/* 상세 */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center gap-2.5 text-[14px]">
          <CalendarClock size={16} className="flex-shrink-0 text-neutral-400" />
          <span data-testid="class-datetime" className="font-semibold">
            {fmtDateTime(o.start_time)} ~ {fmtTime(o.end_time)}
          </span>
        </div>
        {o.instructor_name && (
          <div className="flex items-center gap-2.5 text-[14px]">
            <User2 size={16} className="flex-shrink-0 text-neutral-400" />
            <span data-testid="class-instructor">{o.instructor_name}</span>
          </div>
        )}
        {o.hall_name && (
          <div className="flex items-center gap-2.5 text-[14px]">
            <MapPin size={16} className="flex-shrink-0 text-neutral-400" />
            <span data-testid="class-hall">{o.hall_name}</span>
          </div>
        )}
        {(o.genre || o.difficulty_level) && (
          <p className="text-[13px] text-neutral-500">
            {[o.genre, o.difficulty_level].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* 정원 / 잔여 */}
      <div className="mt-5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
        <span className="text-[13px] text-neutral-500">정원</span>
        {typeof o.max_students === 'number' ? (
          <span data-testid="class-capacity" className="text-[13px] font-bold tabular-nums">
            {o.is_full ? (
              <span className="text-red-500">정원 마감</span>
            ) : (
              <>
                잔여 <b className="text-[15px]">{remaining}</b> / {o.max_students}
              </>
            )}
          </span>
        ) : (
          <span data-testid="class-capacity" className="text-[13px] text-neutral-400">
            제한 없음
          </span>
        )}
      </div>

      {o.is_special && (
        <p className="text-[12px] leading-relaxed mt-4 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {skin?.specialNotice ?? '특별수업은 별도 결제가 필요합니다.'}
        </p>
      )}

      {/* 예약 오픈 전이면 언제 열리는지 */}
      {state === 'NOT_YET_OPEN' && o.opens_at && (
        <p data-testid="class-opens-at" className="text-[13px] font-semibold mt-5 text-neutral-600 dark:text-neutral-300">
          {fmtOpen(o.opens_at)} 예약 오픈
        </p>
      )}

      {/* CTA */}
      <div className="mt-5">
        {state === 'CANCELED' ? (
          <button
            type="button"
            disabled
            data-testid="class-disabled"
            data-reason="CANCELED"
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          >
            휴강된 수업입니다
          </button>
        ) : state === 'NOT_YET_OPEN' ? (
          <button
            type="button"
            disabled
            data-testid="class-disabled"
            data-reason="NOT_YET_OPEN"
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          >
            예약 오픈 전
          </button>
        ) : state === 'CLOSED' ? (
          <button
            type="button"
            disabled
            data-testid="class-disabled"
            data-reason="CLOSED"
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          >
            예약 마감
          </button>
        ) : state === 'FULL' ? (
          <button
            type="button"
            disabled
            data-testid="class-disabled"
            data-reason="FULL"
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
          >
            정원 마감
          </button>
        ) : authLoading ? (
          <button
            type="button"
            disabled
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400"
          >
            불러오는 중…
          </button>
        ) : !user ? (
          <button
            type="button"
            data-testid="class-signin"
            onClick={() => setQuickOpen(true)}
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <ShoppingCart size={15} /> 신청하기
          </button>
        ) : added ? (
          <Link
            href={`/s/${slug}/cart`}
            data-testid="class-go-cart"
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold border flex items-center justify-center gap-2"
            style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
          >
            <Check size={15} /> 장바구니에서 계속
          </Link>
        ) : (
          <button
            type="button"
            data-testid="class-book"
            onClick={handleBook}
            className="w-full py-3.5 rounded-xl text-[14px] font-extrabold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <ShoppingCart size={15} /> 신청하기
          </button>
        )}
      </div>

      <p className="text-[12px] text-neutral-400 text-center mt-4">{academyName}</p>

      {/* 간편가입 — 로그아웃 상태에서 이 자리를 떠나지 않고 즉시 가입·신청 */}
      <QuickJoinSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onSuccess={() => {
          setQuickOpen(false);
          handleBook();
        }}
        onGoLogin={() => {
          setQuickOpen(false);
          router.push(signInHref);
        }}
        subtitle="이름·전화번호·이메일만 입력하면 바로 이 수업을 신청할 수 있어요."
      />
    </div>
  );
}
