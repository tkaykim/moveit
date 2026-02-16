"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Lock, Mail, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ExitQrPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  academyId: string;
}

export function ExitQrPasswordModal({
  isOpen,
  onClose,
  email,
  academyId,
}: ExitQrPasswordModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password.trim()) {
        setError('비밀번호를 입력하세요.');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: password.trim(),
        });
        if (signInError) {
          setError(signInError.message === 'Invalid login credentials' ? '비밀번호가 일치하지 않습니다.' : signInError.message);
          setLoading(false);
          return;
        }
        setPassword('');
        onClose();
        router.push(`/academy-admin/${academyId}`);
      } catch (err: any) {
        setError(err?.message ?? '확인에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [email, password, academyId, onClose, router]
  );

  const handleClose = useCallback(() => {
    if (!loading) {
      setPassword('');
      setError(null);
      onClose();
    }
  }, [loading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-700 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-qr-modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="exit-qr-modal-title" className="text-lg font-bold text-neutral-900 dark:text-white">
            관리자 메뉴로 이동
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors disabled:opacity-50"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          다른 관리자 페이지로 이동하려면 현재 로그인된 계정의 비밀번호를 입력하세요.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              아이디 (현재 로그인 계정)
            </label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              <Mail size={18} className="text-neutral-400 flex-shrink-0" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">{email}</span>
            </div>
          </div>
          <div>
            <label htmlFor="exit-qr-password" className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
              비밀번호
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                id="exit-qr-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00] focus:border-transparent disabled:opacity-50"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary dark:bg-[#CCFF00] text-black font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  확인 중...
                </>
              ) : (
                '확인'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
