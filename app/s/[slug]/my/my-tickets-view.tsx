'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { QrModal } from '@/components/modals/qr-modal';

interface UserTicketRow {
  id: string;
  status: string;
  remaining_count: number | null;
  start_date: string | null;
  expiry_date: string | null;
  tickets?: {
    name?: string;
    ticket_type?: string;
    total_count?: number | null;
    academy_id?: string;
  } | null;
}

interface BookingRow {
  id: string;
  status: string;
  schedules?: {
    start_time?: string;
    end_time?: string;
    classes?: { title?: string; academy_id?: string } | null;
  } | null;
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
 * 미니앱 MY — 이 학원의 내 수강권 + 예약별 출석 QR.
 * 화이트라벨 원칙: 다른 학원 데이터는 보여주지 않는다.
 */
export function MyTicketsView({ academyId, academyName }: { academyId: string; academyName: string }) {
  const { user, loading: authLoading, signIn, signInWithGoogle } = useAuth();
  const [tickets, setTickets] = useState<UserTicketRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBookingId, setQrBookingId] = useState<string | null>(null);

  // 인라인 로그인 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        fetchWithAuth(`/api/user-tickets?academyId=${academyId}`),
        fetchWithAuth('/api/bookings'),
      ]);
      const tData = await tRes.json();
      if (tRes.ok) setTickets(tData.data || []);
      const bData = await bRes.json();
      if (bRes.ok) {
        const now = new Date().toISOString();
        const mine = ((bData.data || []) as BookingRow[]).filter(
          (b) =>
            b.schedules?.classes?.academy_id === academyId &&
            (b.schedules?.start_time || '') >= now &&
            b.status !== 'CANCELED',
        );
        setBookings(mine);
      }
    } catch {
      // 아래 빈 상태로 처리
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => {
    if (user) void load();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, load]);

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
      <div className="px-5 pt-10 max-w-sm mx-auto">
        <h1 className="text-lg font-bold text-center">로그인</h1>
        <p className="text-xs text-neutral-500 text-center mt-1 mb-6">
          내 수강권과 출석 QR을 확인하려면 로그인해 주세요
        </p>
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
          onClick={() => void signInWithGoogle(window.location.pathname)}
          className="w-full mt-2.5 py-3 rounded-xl text-sm font-semibold border border-neutral-200 dark:border-neutral-700"
        >
          Google로 계속하기
        </button>
      </div>
    );
  }

  const active = tickets.filter((t) => t.status === 'ACTIVE');
  const past = tickets.filter((t) => t.status !== 'ACTIVE');

  return (
    <div className="px-5 pt-5 pb-6 space-y-7">
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
              <div key={b.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{b.schedules?.classes?.title || '수업'}</p>
                  <p className="text-xs text-neutral-500">{b.schedules?.start_time ? fmtDateTime(b.schedules.start_time) : ''}</p>
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
              <div key={t.id} className="p-4 rounded-xl border-2" style={{ borderColor: 'var(--primary)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{t.tickets?.name || '수강권'}</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--primary)' }}>
                    사용 중
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                  {typeof t.remaining_count === 'number' && t.tickets?.total_count ? (
                    <span>
                      남은 횟수 <b className="text-neutral-900 dark:text-neutral-100">{t.remaining_count}</b>/{t.tickets.total_count}회
                    </span>
                  ) : null}
                  {t.expiry_date && <span>~{t.expiry_date}까지</span>}
                </div>
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
              <div key={t.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 opacity-60">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.tickets?.name || '수강권'}</p>
                  <span className="text-[11px] text-neutral-400">{t.status === 'EXPIRED' ? '기간 만료' : '사용 완료'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {qrBookingId && <QrModal isOpen={!!qrBookingId} onClose={() => setQrBookingId(null)} bookingId={qrBookingId} />}
    </div>
  );
}
