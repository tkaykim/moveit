'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, QrCode, BadgeCheck, PauseCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { getSafeReturnPath } from '@/lib/auth/return-to';
import { QrModal } from '@/components/modals/qr-modal';
import { QuickJoinSheet } from '@/components/miniapp/quick-join-sheet';

interface MyTicket {
  id: string;
  status: string;
  remaining_count: number | null;
  start_date: string | null;
  expiry_date: string | null;
  name: string;
  ticket_type: string | null;
  total_count: number | null;
  valid_days: number | null;
  start_mode: string;
  /** FIRST_BOOKING 수강권이 아직 첫 예약 전이라 기간이 흐르지 않는 상태 */
  not_started: boolean;
}

interface MyMembership {
  id: string;
  name: string;
  perks: string[];
  start_date: string | null;
  end_date: string | null;
}

interface MyBooking {
  id: string;
  status: string;
  start_time: string | null;
  title: string;
}

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

/**
 * 미니앱 MY — 이 학원의 내 수강권 · 멤버십 · 예약(출석 QR).
 * 화이트라벨 원칙: 다른 학원 데이터는 보여주지 않는다.
 * 데이터는 학원 범위로 이미 좁혀진 /api/s/[slug]/me 한 곳에서만 온다.
 */
export function MyTicketsView({
  slug,
  academyId,
  academyName,
}: {
  slug: string;
  academyId: string;
  academyName: string;
}) {
  const { user, loading: authLoading, signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 딥링크(수업 회차) 등에서 로그인 유도 시 "원래 보던 수업"으로 되돌아가기 위한 경로.
  const nextPath = getSafeReturnPath(searchParams.get('next'));
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [memberships, setMemberships] = useState<MyMembership[]>([]);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBookingId, setQrBookingId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/s/${slug}/me`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setTickets((data.tickets || []) as MyTicket[]);
        setMemberships((data.memberships || []) as MyMembership[]);
        setBookings((data.bookings || []) as MyBooking[]);
      }
    } catch {
      /* 아래 빈 상태로 처리 */
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (user) void load();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, load]);

  // 로그인이 완료되면(이메일·OAuth 공통) return-to 로 되돌린다. 딥링크에서 온 학생을
  // "같은 수업"으로 정확히 돌려보내는 지점이다.
  useEffect(() => {
    if (user && nextPath) router.replace(nextPath);
  }, [user, nextPath, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setLoginError('이메일 또는 비밀번호를 확인해 주세요.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (authLoading || (user && loading)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin" size={26} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5 pt-10 max-w-sm mx-auto" data-testid="my-login">
        <h1 className="text-lg font-bold text-center">시작하기</h1>
        <p className="text-xs text-neutral-500 text-center mt-1 mb-6">
          내 수강권과 출석 QR을 확인하려면 로그인하거나 간편가입해 주세요
        </p>

        {/* 간편가입 — 비회원도 이름·전화·이메일만으로 즉시 계정 생성 */}
        <button
          type="button"
          data-testid="quick-join-open"
          onClick={() => setQuickOpen(true)}
          className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          이름·전화·이메일로 간편가입
        </button>
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          <span className="text-[11px] text-neutral-400">이미 계정이 있어요</span>
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <form onSubmit={handleLogin} className="space-y-2.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-4 py-3 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-transparent px-4 py-3 text-sm"
          />
          {loginError && <p className="text-xs text-red-500">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {loggingIn && <Loader2 size={14} className="animate-spin" />}
            로그인
          </button>
        </form>
        <button
          onClick={() => void signInWithGoogle(nextPath ?? window.location.pathname)}
          className="w-full mt-2.5 py-3 rounded-xl text-sm font-semibold border border-neutral-200 dark:border-neutral-700"
        >
          Google로 계속하기
        </button>

        {/* 간편가입 시트 — 성공 시 user 갱신 → 티켓 로드 + next 복귀가 자동 수행됨 */}
        <QuickJoinSheet
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          onSuccess={() => setQuickOpen(false)}
          onGoLogin={(prefillEmail) => {
            if (prefillEmail) setEmail(prefillEmail);
            setQuickOpen(false);
          }}
        />
      </div>
    );
  }

  const active = tickets.filter((t) => t.status === 'ACTIVE');
  const past = tickets.filter((t) => t.status !== 'ACTIVE');

  return (
    <div className="px-5 pt-5 pb-6 space-y-7">
      {/* 내 멤버십 — 가진 사람에게만 보인다 */}
      {memberships.length > 0 && (
        <section data-testid="my-memberships">
          <h2 className="text-sm font-bold text-neutral-500 mb-2.5">내 멤버십</h2>
          <div className="space-y-2.5">
            {memberships.map((m) => (
              <div
                key={m.id}
                data-testid="membership-card"
                className="p-4 rounded-xl text-white"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <div className="flex items-center gap-1.5">
                  <BadgeCheck size={16} />
                  <p className="text-sm font-bold">{m.name}</p>
                </div>
                {m.end_date && <p className="text-[11px] opacity-80 mt-1">~{m.end_date}까지</p>}
                {m.perks?.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {m.perks.map((p) => (
                      <li key={p} className="text-[11px] opacity-90">
                        · {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 다가오는 예약 + 출석 QR */}
      <section>
        <h2 className="text-sm font-bold text-neutral-500 mb-2.5">다가오는 예약</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-neutral-500 py-6 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            예약된 수업이 없습니다
          </p>
        ) : (
          <div className="space-y-2.5">
            {bookings.map((b) => (
              <div
                key={b.id}
                data-testid="my-booking"
                className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{b.title}</p>
                  <p className="text-xs text-neutral-500">
                    {b.start_time ? fmtDateTime(b.start_time) : ''}
                  </p>
                </div>
                <button
                  onClick={() => setQrBookingId(b.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <QrCode size={14} /> 출석 QR
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 사용 중 수강권 */}
      <section>
        <h2 className="text-sm font-bold text-neutral-500 mb-2.5">사용 중인 수강권</h2>
        {active.length === 0 ? (
          <p className="text-sm text-neutral-500 py-8 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            {academyName}의 수강권이 없습니다
          </p>
        ) : (
          <div className="space-y-2.5">
            {active.map((t) => (
              <div
                key={t.id}
                data-testid="my-ticket"
                data-not-started={t.not_started ? '1' : '0'}
                className="p-4 rounded-xl border-2"
                style={{ borderColor: 'var(--primary)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold truncate">{t.name}</p>
                  {t.not_started ? (
                    <span
                      data-testid="ticket-not-started"
                      className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 flex-shrink-0"
                    >
                      <PauseCircle size={10} /> 아직 시작 안 함
                    </span>
                  ) : (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      사용 중
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                  {typeof t.remaining_count === 'number' && (
                    <span data-testid="ticket-remaining">
                      남은 횟수{' '}
                      <b className="text-neutral-900 dark:text-neutral-100">{t.remaining_count}</b>
                      {t.total_count ? `/${t.total_count}` : ''}회
                    </span>
                  )}
                  {t.not_started ? (
                    <span data-testid="ticket-expiry">
                      첫 예약일부터 {t.valid_days ? `${t.valid_days}일` : '유효기간'} 시작
                    </span>
                  ) : (
                    t.expiry_date && <span data-testid="ticket-expiry">~{t.expiry_date}까지</span>
                  )}
                </div>

                {t.not_started && (
                  <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
                    첫 수업을 예약하면 그날부터 유효기간이 시작됩니다.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 지난 수강권 */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-neutral-500 mb-2.5">지난 수강권</h2>
          <div className="space-y-2">
            {past.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  <span className="text-[11px] text-neutral-400 flex-shrink-0">
                    {t.status === 'EXPIRED' ? '기간 만료' : '사용 완료'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {qrBookingId && (
        <QrModal isOpen={!!qrBookingId} onClose={() => setQrBookingId(null)} bookingId={qrBookingId} />
      )}
    </div>
  );
}
