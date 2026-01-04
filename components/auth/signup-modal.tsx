'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authTestLogger } from '@/lib/utils/auth-test-logger';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  enableLogging?: boolean;
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function SignupModal({ isOpen, onClose, enableLogging = false, onSuccess, onSwitchToLogin }: SignupModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccess(false);
    setNeedsEmailVerification(false);

    if (enableLogging) {
      authTestLogger.addLog('info', 'SIGNUP_START', '회원가입 시작', {
        email: email.trim().toLowerCase(),
        hasName: !!name.trim(),
      });
    }

    // 입력 검증
    if (password.length < 6) {
      const errorMsg = '비밀번호는 최소 6자 이상이어야 합니다.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'SIGNUP_VALIDATION_ERROR', errorMsg, {
          passwordLength: password.length,
        });
      }
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      const errorMsg = '이메일을 입력해주세요.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'SIGNUP_VALIDATION_ERROR', errorMsg);
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (enableLogging) {
        authTestLogger.addLog('info', 'SIGNUP_API_CALL', 'Supabase signUp API 호출', {
          email: email.trim().toLowerCase(),
        });
      }

      const startTime = Date.now();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim() || null,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/admin`,
        },
      });
      const duration = Date.now() - startTime;

      if (authError) {
        let errorMessage = authError.message;
        if (authError.message.includes('already registered')) {
          errorMessage = '이미 등록된 이메일입니다.';
        } else if (authError.message.includes('Invalid email')) {
          errorMessage = '유효하지 않은 이메일 형식입니다.';
        } else if (authError.message.includes('Password')) {
          errorMessage = '비밀번호가 너무 짧습니다.';
        }
        setError(errorMessage);
        if (enableLogging) {
          authTestLogger.addLog('error', 'SIGNUP_API_ERROR', errorMessage, {
            originalError: authError.message,
            errorCode: authError.status,
          }, authError);
        }
        setLoading(false);
        return;
      }

      if (enableLogging) {
        authTestLogger.addLog('success', 'SIGNUP_API_SUCCESS', 'Supabase signUp API 성공', {
          duration: `${duration}ms`,
          hasUser: !!authData.user,
          hasSession: !!authData.session,
          userId: authData.user?.id,
        });
      }

      // 회원가입 성공
      if (authData.user && !authData.session) {
        setNeedsEmailVerification(true);
        setSuccess(true);
        if (enableLogging) {
          authTestLogger.addLog('warning', 'SIGNUP_EMAIL_VERIFICATION_REQUIRED', '이메일 인증이 필요합니다', {
            email: authData.user.email,
          });
        }
      } else if (authData.session && authData.user) {
        setSuccess(true);
        if (enableLogging) {
          authTestLogger.addLog('success', 'SIGNUP_COMPLETE', '회원가입 완료 (세션 생성됨)', {
            userId: authData.user.id,
            email: authData.user.email,
          });
        }
        // 성공 콜백 호출
        if (onSuccess) {
          onSuccess();
        } else {
          // onSuccess가 없으면 모달을 닫고 페이지 새로고침
          onClose();
          setTimeout(() => {
            window.location.reload();
          }, 500);
        }
      } else {
        const errorMsg = '회원가입에 실패했습니다. 다시 시도해주세요.';
        setError(errorMsg);
        if (enableLogging) {
          authTestLogger.addLog('error', 'SIGNUP_UNEXPECTED_ERROR', errorMsg, {
            authData,
          });
        }
      }
    } catch (err: any) {
      console.error('회원가입 오류:', err);
      const errorMsg = '회원가입 중 오류가 발생했습니다. 다시 시도해주세요.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'SIGNUP_EXCEPTION', errorMsg, {
          errorType: err?.constructor?.name,
          errorMessage: err?.message,
        }, err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (enableLogging) {
      authTestLogger.addLog('info', 'SIGNUP_RESEND_EMAIL', '인증 이메일 재전송 시작', {
        email: email.trim().toLowerCase(),
      });
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/admin`,
      },
    });

    if (error) {
      const errorMsg = '이메일 재전송 중 오류가 발생했습니다.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'SIGNUP_RESEND_EMAIL_ERROR', errorMsg, {
          originalError: error.message,
        }, error);
      }
    } else {
      setError('');
      alert('인증 이메일을 다시 보냈습니다.');
      if (enableLogging) {
        authTestLogger.addLog('success', 'SIGNUP_RESEND_EMAIL_SUCCESS', '인증 이메일 재전송 성공');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            회원가입
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && needsEmailVerification && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded">
              <p className="font-semibold mb-1">이메일 인증이 필요합니다</p>
              <p className="text-sm">
                {email}로 인증 링크를 보냈습니다. 이메일을 확인하고 링크를 클릭해주세요.
              </p>
            </div>
          )}

          {success && !needsEmailVerification && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
              회원가입이 완료되었습니다!
            </div>
          )}

          <div>
            <label htmlFor="signup-name" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              이름
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              이메일
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              비밀번호
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-neutral-500">최소 6자 이상</p>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '가입 중...' : success ? '가입 완료' : '회원가입'}
          </button>
        </form>

        {!success && (
          <div className="mt-4 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onSwitchToLogin) {
                    onSwitchToLogin();
                  }
                }}
                className="text-primary hover:underline font-medium"
              >
                로그인
              </button>
            </p>
          </div>
        )}

        {success && needsEmailVerification && (
          <div className="mt-4 text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              이메일을 받지 못하셨나요?
            </p>
            <button
              type="button"
              onClick={handleResendEmail}
              className="text-sm text-primary hover:underline font-medium"
            >
              인증 이메일 다시 보내기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

