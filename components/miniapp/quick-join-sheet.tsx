'use client';

/**
 * Q-간편가입 시트 (2026-07-22)
 *
 * 비회원이 이름+전화번호+이메일만 입력하면 **비밀번호 없이 즉시** 로그인된 계정이
 * 생기고, 하던 예약/결제를 그 자리에서 이어간다. (이메일 왕복·페이지 이탈 없음)
 *
 * 규율:
 *   ① 서버 라우트 POST /api/auth/quick-signup 만 신뢰한다. 화면은 결과 상태만 그린다.
 *   ② status:'CREATED' 일 때만 token_hash 로 세션을 확립한다. 'EXISTS' 는 토큰이
 *      없으므로 기존 로그인으로 유도한다(이메일 프리필).
 *   ③ 미니앱 비주얼 언어(var(--primary)·둥근 시트·모바일 우선)를 따른다.
 */

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ModalPortal } from '@/components/common/modal-portal';
import { formatPhoneDisplay, parsePhoneInput } from '@/lib/utils/phone';

interface QuickJoinSheetProps {
  open: boolean;
  onClose: () => void;
  /** 세션이 확립된 뒤 호출 — 부모가 중단된 예약/결제를 이어간다. */
  onSuccess: () => void;
  /** "이미 계정이 있어요" 또는 EXISTS 응답 시 호출. prefillEmail 이 있으면 로그인 폼에 채운다. */
  onGoLogin?: (prefillEmail?: string) => void;
  title?: string;
  subtitle?: string;
}

export function QuickJoinSheet({
  open,
  onClose,
  onSuccess,
  onGoLogin,
  title = '간편가입하고 계속하기',
  subtitle = '이름·전화번호·이메일만 있으면 바로 시작할 수 있어요.',
}: QuickJoinSheetProps) {
  const { verifyEmailOtp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const phoneDigits = parsePhoneInput(phone);
  const canSubmit =
    name.trim().length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    phoneDigits.length >= 9 &&
    phoneDigits.length <= 11;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/quick-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phoneDigits, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (data?.status === 'EXISTS') {
        if (data.reason === 'PHONE') {
          setError('이 전화번호로 이미 가입된 계정이 있어요. 기존 이메일로 로그인해 주세요.');
          if (onGoLogin) setTimeout(() => onGoLogin(), 1200);
        } else {
          setError('이미 가입된 이메일이에요. 로그인으로 이동할게요.');
          if (onGoLogin) setTimeout(() => onGoLogin(email.trim()), 1000);
        }
        setLoading(false);
        return;
      }

      if (data?.status === 'CREATED' && data.token_hash) {
        const { error: otpErr } = await verifyEmailOtp(data.token_hash);
        if (otpErr) {
          setError('로그인 처리에 실패했어요. 잠시 후 다시 시도해 주세요.');
          setLoading(false);
          return;
        }
        // 세션 확립 완료 — 부모가 중단된 행동을 이어간다.
        onSuccess();
        return;
      }

      if (data?.status === 'CREATED_NO_SESSION') {
        setError('가입은 완료됐어요. 로그인으로 이동할게요.');
        if (onGoLogin) setTimeout(() => onGoLogin(email.trim()), 1000);
        setLoading(false);
        return;
      }

      if (data?.status === 'RATE_LIMITED') {
        setError('요청이 많아요. 잠시 후 다시 시도해 주세요.');
        setLoading(false);
        return;
      }

      if (data?.status === 'INVALID') {
        const f = data.field;
        setError(
          f === 'email' ? '이메일 형식을 확인해 주세요.'
          : f === 'phone' ? '전화번호를 정확히 입력해 주세요.'
          : '이름을 입력해 주세요.'
        );
        setLoading(false);
        return;
      }

      setError('가입에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setLoading(false);
    } catch {
      setError('네트워크 오류로 가입하지 못했어요. 다시 시도해 주세요.');
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          data-testid="quick-join-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="간편가입"
          className="w-full max-w-[420px] bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="text-[18px] font-extrabold tracking-tight break-keep">{title}</h2>
              <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed break-keep">{subtitle}</p>
            </div>
            <button
              type="button"
              aria-label="닫기"
              data-testid="quick-join-close"
              onClick={onClose}
              className="p-2 -mr-2 -mt-1 rounded-full text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-2.5">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              autoComplete="name"
              data-testid="quick-join-name"
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <input
              type="tel"
              inputMode="numeric"
              value={formatPhoneDisplay(phone)}
              onChange={(e) => setPhone(parsePhoneInput(e.target.value))}
              placeholder="전화번호 (예: 010-0000-0000)"
              autoComplete="tel"
              data-testid="quick-join-phone"
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              autoComplete="email"
              data-testid="quick-join-email"
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />

            {error && (
              <p data-testid="quick-join-error" className="text-[12px] font-semibold text-red-600 dark:text-red-400 leading-relaxed pt-0.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              data-testid="quick-join-submit"
              disabled={!canSubmit || loading}
              className="w-full py-3.5 rounded-xl text-[14px] font-extrabold text-white disabled:opacity-40 flex items-center justify-center gap-2 mt-1"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              가입하고 계속하기
            </button>
          </form>

          <button
            type="button"
            data-testid="quick-join-to-login"
            onClick={() => (onGoLogin ? onGoLogin() : onClose())}
            className="w-full mt-3 py-2 text-[12px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            이미 계정이 있어요 <span className="font-bold" style={{ color: 'var(--primary)' }}>→ 로그인</span>
          </button>

          <p className="text-[10px] text-neutral-400 text-center mt-3 leading-relaxed break-keep">
            가입 시 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </ModalPortal>
  );
}
