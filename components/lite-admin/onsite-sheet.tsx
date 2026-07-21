'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Check, CreditCard, Banknote, UserPlus, Ticket } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { ticketTypeLabel } from './ticket-label';
import { StudentPicker, type StudentRow } from './student-search';

interface Product {
  id: string;
  name: string;
  ticket_type: string | null;
  price: number | null;
  count_options: Array<{ count?: number; price?: number; label?: string }> | null;
  is_fixed_weekly: boolean | null;
  is_on_sale: boolean | null;
}

interface TodayOcc {
  schedule_id: string;
  class_id: string;
  class_title: string;
  start_time: string;
  is_canceled: boolean;
}

const inputCls =
  'w-full h-12 px-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[15px]';
const labelCls = 'block text-[12px] font-bold text-neutral-500 mb-1.5';

const won = (n: number | null | undefined) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '');

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
}
function kstTodayStr(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

type PayMemo = '현금' | '카드단말' | '기타';

/**
 * 현장결제 / 수강권 수동발급 공용 시트.
 * 학생(회원/비회원) → 상품 → (선택) 오늘 수업 즉시 예약 → 결제수단 메모 → 확정.
 * 발급은 기존 ONSITE 경로(POST /api/a/[id]/onsite-order)로만 이뤄진다 — 새 발급 로직 없음.
 */
export function OnsiteSheet({
  academyId,
  brand,
  presetStudent,
  title = '현장결제',
  allowToday = true,
  onClose,
  onDone,
}: {
  academyId: string;
  brand: string;
  presetStudent?: StudentRow | null;
  title?: string;
  allowToday?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [student, setStudent] = useState<StudentRow | null>(presetStudent ?? null);
  const [guestMode, setGuestMode] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [optionIdx, setOptionIdx] = useState<number | null>(null);
  const [fixedClassId, setFixedClassId] = useState('');

  const [today, setToday] = useState<TodayOcc[]>([]);
  const [bookScheduleId, setBookScheduleId] = useState('');

  const [memo, setMemo] = useState<PayMemo>('현금');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ issued: number; booked: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [pRes, tRes] = await Promise.all([
        fetchWithAuth(`/api/a/${academyId}/products`, { cache: 'no-store' }),
        allowToday
          ? fetchWithAuth(`/api/a/${academyId}/occurrences?from=${kstTodayStr()}&to=${kstTodayStr()}`, { cache: 'no-store' })
          : Promise.resolve(null),
      ]);
      if (pRes.ok) setProducts((await pRes.json()).products ?? []);
      if (tRes && tRes.ok) setToday(((await tRes.json()).occurrences ?? []).filter((o: TodayOcc) => !o.is_canceled));
    })();
  }, [academyId, allowToday]);

  const product = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);
  const needsFixedClass = !!product?.is_fixed_weekly;
  const hasOptions = (product?.count_options?.length ?? 0) > 0;

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (!student && !guestMode) return setErr('학생을 선택하거나 비회원으로 진행해 주세요.');
    if (guestMode && (!guestName.trim() || !guestPhone.trim())) return setErr('비회원 이름과 전화번호를 입력해 주세요.');
    if (!productId) return setErr('수강권 상품을 선택해 주세요.');
    if (needsFixedClass && !fixedClassId) return setErr('고정반 수업을 선택해 주세요.');

    const items: Record<string, unknown>[] = [
      {
        item_type: 'TICKET_PURCHASE',
        ticket_id: productId,
        count_option_index: hasOptions ? optionIdx : null,
        fixed_class_id: needsFixedClass ? fixedClassId : null,
      },
    ];
    if (bookScheduleId) {
      items.push({ item_type: 'SCHEDULE_BOOKING', schedule_id: bookScheduleId, use_purchase_index: 0 });
    }

    setBusy(true);
    try {
      const res = await fetchWithAuth(`/api/a/${academyId}/onsite-order`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: guestMode ? null : student?.user_id ?? null,
          orderer: guestMode ? { name: guestName.trim(), phone: guestPhone.trim() } : null,
          items,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || '발급에 실패했어요.');
        return;
      }
      setDone({ issued: json.issued_tickets ?? 0, booked: json.created_bookings ?? 0 });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" data-testid="onsite-sheet">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg bg-white dark:bg-neutral-950 rounded-t-3xl max-h-[92dvh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center">
          <p className="text-[17px] font-extrabold">{title}</p>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center" data-testid="onsite-done">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: brand }}>
              <Check size={28} className="text-white" />
            </div>
            <p className="text-[16px] font-extrabold">발급 완료</p>
            <p className="text-sm text-neutral-500 mt-1">
              수강권 {done.issued}건 발급{done.booked > 0 ? ` · 오늘 수업 ${done.booked}건 예약` : ''}
            </p>
            <p className="text-[12px] text-neutral-400 mt-1">결제수단: {memo} (표시용)</p>
            <button
              type="button"
              data-testid="onsite-close"
              onClick={onClose}
              className="mt-6 w-full h-12 rounded-xl font-extrabold text-white text-[15px]"
              style={{ backgroundColor: brand }}
            >
              닫기
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 학생 */}
              <div>
                <label className={labelCls}>학생</label>
                {student ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                    <span className="text-[15px] font-bold truncate">{student.name}</span>
                    {student.contact && <span className="text-[11px] text-neutral-500 truncate">{student.contact}</span>}
                    {!presetStudent && (
                      <button
                        type="button"
                        onClick={() => setStudent(null)}
                        className="ml-auto text-[12px] font-bold"
                        style={{ color: brand }}
                      >
                        변경
                      </button>
                    )}
                  </div>
                ) : guestMode ? (
                  <div className="space-y-2">
                    <input data-testid="guest-name" className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="비회원 이름" />
                    <input data-testid="guest-phone" className={inputCls} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="전화번호" inputMode="tel" />
                    <button type="button" onClick={() => setGuestMode(false)} className="text-[12px] font-bold" style={{ color: brand }}>
                      회원 검색으로
                    </button>
                  </div>
                ) : (
                  <>
                    <StudentPicker academyId={academyId} brand={brand} onPick={setStudent} testId="onsite-student" />
                    <button
                      type="button"
                      data-testid="onsite-guest-toggle"
                      onClick={() => setGuestMode(true)}
                      className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold"
                      style={{ color: brand }}
                    >
                      <UserPlus size={14} /> 비회원으로 발급
                    </button>
                  </>
                )}
              </div>

              {/* 상품 */}
              <div>
                <label className={labelCls}>수강권 상품</label>
                <select
                  data-testid="onsite-product"
                  className={inputCls}
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setOptionIdx(null);
                    setFixedClassId('');
                  }}
                >
                  <option value="">선택해 주세요</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {ticketTypeLabel(p.ticket_type)}
                      {typeof p.price === 'number' ? ` · ${won(p.price)}` : ''}
                    </option>
                  ))}
                </select>
                {products.length === 0 && (
                  <p className="mt-1.5 text-[12px] text-neutral-400">판매중인 수강권이 없어요.</p>
                )}
              </div>

              {/* 횟수 옵션 */}
              {hasOptions && product && (
                <div>
                  <label className={labelCls}>옵션</label>
                  <select
                    data-testid="onsite-option"
                    className={inputCls}
                    value={optionIdx ?? ''}
                    onChange={(e) => setOptionIdx(e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <option value="">기본</option>
                    {product.count_options!.map((o, i) => (
                      <option key={i} value={i}>
                        {o.label ?? `${o.count ?? ''}회`}
                        {typeof o.price === 'number' ? ` · ${won(o.price)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 고정반 수업 */}
              {needsFixedClass && (
                <div>
                  <label className={labelCls}>고정반 수업</label>
                  <select
                    data-testid="onsite-fixed-class"
                    className={inputCls}
                    value={fixedClassId}
                    onChange={(e) => setFixedClassId(e.target.value)}
                  >
                    <option value="">수업 선택</option>
                    {Array.from(new Map(today.map((o) => [o.class_id, o.class_title])).entries()).map(([cid, tt]) => (
                      <option key={cid} value={cid}>
                        {tt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 오늘 수업 즉시 예약 */}
              {allowToday && today.length > 0 && (
                <div>
                  <label className={labelCls}>오늘 수업 즉시 예약 (선택)</label>
                  <select
                    data-testid="onsite-book-today"
                    className={inputCls}
                    value={bookScheduleId}
                    onChange={(e) => setBookScheduleId(e.target.value)}
                  >
                    <option value="">예약 안 함</option>
                    {today.map((o) => (
                      <option key={o.schedule_id} value={o.schedule_id}>
                        {fmtTime(o.start_time)} · {o.class_title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 결제수단 메모 (표시용) */}
              <div>
                <label className={labelCls}>결제수단 (표시용)</label>
                <div className="grid grid-cols-3 gap-2" data-testid="onsite-memo">
                  {([
                    { k: '현금' as PayMemo, icon: Banknote },
                    { k: '카드단말' as PayMemo, icon: CreditCard },
                    { k: '기타' as PayMemo, icon: Ticket },
                  ]).map(({ k, icon: Icon }) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMemo(k)}
                      className={`h-11 rounded-xl border text-[13px] font-bold flex items-center justify-center gap-1 ${
                        memo === k ? 'text-white border-transparent' : 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
                      }`}
                      style={memo === k ? { backgroundColor: brand } : undefined}
                    >
                      <Icon size={14} /> {k}
                    </button>
                  ))}
                </div>
              </div>

              {err && <p className="text-[13px] font-semibold text-red-500" data-testid="onsite-error">{err}</p>}
            </div>

            <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-800" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
              <button
                type="button"
                data-testid="onsite-submit"
                disabled={busy}
                onClick={submit}
                className="w-full h-12 rounded-xl font-extrabold text-white text-[15px] disabled:opacity-50"
                style={{ backgroundColor: brand }}
              >
                {busy ? '처리 중...' : '결제 확정하고 발급'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
