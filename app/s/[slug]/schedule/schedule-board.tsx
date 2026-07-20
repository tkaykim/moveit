'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Lock, ShoppingCart, Check } from 'lucide-react';
import type { MiniWeekItem } from '@/lib/db/miniapp';
import type { MiniSkin } from '@/lib/miniapp/skin';
import { addToCart, readCart } from '@/lib/miniapp/cart';
import { CopyLinkButton } from '@/components/share/copy-link-button';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function kstDow(iso: string): number {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).getUTCDay();
}

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

/**
 * 주간 시간표. 서버가 준 items 를 **그대로** 그린다 —
 * 여기서 수업을 걸러내지 않는다(가림은 RLS 의 몫).
 */
export function ScheduleBoard({
  slug,
  academyId,
  skin,
  offset,
  weekStartIso,
  items,
}: {
  slug: string;
  academyId: string;
  skin: MiniSkin;
  offset: number;
  weekStartIso: string;
  items: MiniWeekItem[];
}) {
  const [inCart, setInCart] = useState<Set<string>>(new Set());
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const sync = () => {
      const ids = readCart(academyId)
        .map((e) => (e.item.item_type === 'SCHEDULE_BOOKING' ? e.item.schedule_id : null))
        .filter(Boolean) as string[];
      setInCart(new Set(ids));
    };
    sync();
    window.addEventListener('miniapp-cart-changed', sync);
    return () => window.removeEventListener('miniapp-cart-changed', sync);
  }, [academyId]);

  const byDay = new Map<number, MiniWeekItem[]>();
  for (const s of items) {
    const d = kstDow(s.start_time);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(s);
  }

  const weekStart = new Date(weekStartIso);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const rangeLabel = `${weekStart.getMonth() + 1}.${weekStart.getDate()} – ${weekEnd.getMonth() + 1}.${weekEnd.getDate()}`;
  const todayDow = kstDow(new Date().toISOString());

  const hasSpecial = items.some((i) => i.is_special);

  const handleAdd = (s: MiniWeekItem) => {
    addToCart(academyId, {
      label: s.title,
      sublabel: `${fmtTime(s.start_time)} · ${s.group_name ?? ''}`.trim(),
      item: { item_type: 'SCHEDULE_BOOKING', schedule_id: s.id, use_purchase_index: null },
    });
  };

  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <p
            className="text-[11px] font-bold tracking-widest uppercase"
            style={{ color: 'var(--primary)' }}
          >
            {skin.heroEyebrow}
          </p>
          <h1 className="text-[24px] font-extrabold tracking-tight mt-0.5">시간표</h1>
        </div>
        <div className="flex items-center gap-1 pb-0.5 flex-shrink-0">
          <Link
            href={`/s/${slug}/schedule?w=${offset - 1}`}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
            aria-label="이전 주"
          >
            <ChevronLeft size={15} />
          </Link>
          <span className="px-1.5 text-[12px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums whitespace-nowrap">
            {rangeLabel}
          </span>
          <Link
            href={`/s/${slug}/schedule?w=${offset + 1}`}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-500"
            aria-label="다음 주"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {skin.scheduleNote && (
        <p className="text-[12px] text-neutral-500 mb-4 leading-relaxed">{skin.scheduleNote}</p>
      )}

      {hasSpecial && (
        <p
          data-testid="special-notice"
          className="text-[12px] leading-relaxed mb-5 px-3.5 py-2.5 rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          {skin.specialNotice}
        </p>
      )}

      {items.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">이번 주 등록된 수업이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-7">
          {[0, 1, 2, 3, 4, 5, 6]
            .map((d) => (d + 1) % 7)
            .filter((d) => byDay.has(d))
            .map((d) => {
              const isToday = offset === 0 && d === todayDow;
              return (
                <section key={d}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold ${
                        isToday ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
                      }`}
                      style={isToday ? { backgroundColor: 'var(--primary)' } : undefined}
                    >
                      {DAY_LABELS[d]}
                    </span>
                    {isToday && (
                      <span className="text-[11px] font-bold" style={{ color: 'var(--primary)' }}>
                        오늘
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {byDay.get(d)!.map((s) => {
                      const added = inCart.has(s.id);
                      const notYet = s.booking_state === 'NOT_YET_OPEN';
                      return (
                        <div
                          key={s.id}
                          data-testid="schedule-row"
                          data-schedule-id={s.id}
                          data-special={s.is_special ? '1' : '0'}
                          className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-900"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-[48px] flex-shrink-0">
                              <p className="text-[15px] font-extrabold tabular-nums leading-tight">
                                {fmtTime(s.start_time)}
                              </p>
                              <p className="text-[10px] text-neutral-400 tabular-nums mt-0.5">
                                ~{fmtTime(s.end_time)}
                              </p>
                            </div>
                            <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-bold truncate">{s.title}</p>
                              <p className="text-xs text-neutral-500 truncate mt-0.5">
                                {[s.genre, s.difficulty_level, s.instructor_name]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                            {s.is_full ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 flex-shrink-0">
                                마감
                              </span>
                            ) : (
                              typeof s.max_students === 'number' && (
                                <span className="text-[11px] text-neutral-400 flex-shrink-0 tabular-nums">
                                  {s.booked_count}/{s.max_students}
                                </span>
                              )
                            )}
                            {/* 이 수업 링크 복사 — 학원이든 학생이든 한 회차를 바로 공유 */}
                            <CopyLinkButton
                              url={`${origin}/s/${slug}/c/${s.id}`}
                              testId="schedule-copy-link"
                              iconOnly
                              ariaLabel={`${s.title} 신청 링크 복사`}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex-shrink-0"
                            />
                          </div>

                          {/* 배지: 그룹 · 특별수업 · 대상한정 */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            {s.group_name && (
                              <span
                                data-testid="group-badge"
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                              >
                                {s.group_name}
                              </span>
                            )}
                            {s.is_special && (
                              <span
                                data-testid="special-badge"
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                              >
                                특별수업 · 별도 결제
                              </span>
                            )}
                            {s.is_audience_limited && (
                              <span
                                data-testid="audience-badge"
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                              >
                                <Lock size={9} /> 멤버십 전용
                              </span>
                            )}
                          </div>

                          {/* 예약 오픈 전이면 언제 열리는지 */}
                          {notYet && s.opens_at && (
                            <p
                              data-testid="opens-at"
                              className="text-[11px] font-semibold mt-2 text-neutral-500"
                            >
                              {fmtOpen(s.opens_at)} 예약 오픈
                            </p>
                          )}

                          <div className="mt-2.5">
                            {notYet ? (
                              <button
                                type="button"
                                disabled
                                data-testid="add-disabled"
                                className="w-full py-2 rounded-lg text-[12px] font-bold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                              >
                                예약 오픈 전
                              </button>
                            ) : s.booking_state === 'CLOSED' ? (
                              <button
                                type="button"
                                disabled
                                data-testid="add-disabled"
                                className="w-full py-2 rounded-lg text-[12px] font-bold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                              >
                                예약 마감
                              </button>
                            ) : s.is_full ? (
                              <button
                                type="button"
                                disabled
                                data-testid="add-disabled"
                                className="w-full py-2 rounded-lg text-[12px] font-bold bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                              >
                                정원 마감
                              </button>
                            ) : added ? (
                              <Link
                                href={`/s/${slug}/cart`}
                                data-testid="go-cart"
                                className="w-full py-2 rounded-lg text-[12px] font-bold border flex items-center justify-center gap-1.5"
                                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                              >
                                <Check size={13} /> 장바구니에 담김
                              </Link>
                            ) : (
                              <button
                                type="button"
                                data-testid="add-to-cart"
                                onClick={() => handleAdd(s)}
                                className="w-full py-2 rounded-lg text-[12px] font-bold text-white flex items-center justify-center gap-1.5"
                                style={{ backgroundColor: 'var(--primary)' }}
                              >
                                <ShoppingCart size={13} /> 담기
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
