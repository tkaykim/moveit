'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authTestLogger } from '@/lib/utils/auth-test-logger';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  enableLogging?: boolean;
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
}

export function LoginModal({ isOpen, onClose, enableLogging = false, onSuccess, onSwitchToSignup }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (enableLogging) {
      authTestLogger.addLog('info', 'LOGIN_START', '로그인 시작', {
        email: email.trim().toLowerCase(),
      });
    }

    // 입력 검증
    if (!email.trim()) {
      const errorMsg = '이메일을 입력해주세요.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'LOGIN_VALIDATION_ERROR', errorMsg);
      }
      setLoading(false);
      return;
    }

    if (!password) {
      const errorMsg = '비밀번호를 입력해주세요.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'LOGIN_VALIDATION_ERROR', errorMsg);
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (enableLogging) {
        authTestLogger.addLog('info', 'LOGIN_API_CALL', 'Supabase signInWithPassword API 호출', {
          email: email.trim().toLowerCase(),
        });
      }

      const startTime = Date.now();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      const duration = Date.now() - startTime;

      if (authError) {
        let errorMessage = authError.message;
        if (authError.message.includes('Invalid login credentials') || authError.message.includes('invalid')) {
          errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
        } else if (authError.message.includes('Email not confirmed') || authError.message.includes('not confirmed')) {
          errorMessage = '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
        } else if (authError.message.includes('User not found')) {
          errorMessage = '등록되지 않은 이메일입니다.';
        }
        setError(errorMessage);
        if (enableLogging) {
          authTestLogger.addLog('error', 'LOGIN_API_ERROR', errorMessage, {
            originalError: authError.message,
            errorCode: authError.status,
          }, authError);
        }
        setLoading(false);
        return;
      }

      if (enableLogging) {
        authTestLogger.addLog('success', 'LOGIN_API_SUCCESS', 'Supabase signInWithPassword API 성공', {
          duration: `${duration}ms`,
          hasSession: !!data.session,
          hasUser: !!data.user,
          userId: data.user?.id,
        });
      }

      // 로그인 성공 확인
      if (data.session && data.user) {
        if (enableLogging) {
          authTestLogger.addLog('info', 'LOGIN_SESSION_CHECK', '세션 저장 확인 중');
        }

        const sessionCheckStartTime = Date.now();
        const { data: { session: confirmedSession } } = await supabase.auth.getSession();
        const sessionCheckDuration = Date.now() - sessionCheckStartTime;

        if (confirmedSession) {
          if (enableLogging) {
            authTestLogger.addLog('success', 'LOGIN_COMPLETE', '로그인 완료 (세션 확인됨)', {
              sessionCheckDuration: `${sessionCheckDuration}ms`,
              userId: confirmedSession.user.id,
              email: confirmedSession.user.email,
              expiresAt: confirmedSession.expires_at,
            });
          }
          // 성공 콜백 호출
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 1000);
          } else {
            // 성공 메시지 표시 후 모달 닫기
            setTimeout(() => {
              onClose();
            }, 1000);
          }
        } else {
          if (enableLogging) {
            authTestLogger.addLog('error', 'LOGIN_SESSION_NOT_FOUND', '세션이 저장되지 않았습니다', {
              sessionCheckDuration: `${sessionCheckDuration}ms`,
            });
          }
          setError('세션 저장에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        const errorMsg = '로그인에 실패했습니다. 다시 시도해주세요.';
        setError(errorMsg);
        if (enableLogging) {
          authTestLogger.addLog('error', 'LOGIN_UNEXPECTED_ERROR', errorMsg, {
            data,
          });
        }
      }
    } catch (err: any) {
      console.error('로그인 오류:', err);
      const errorMsg = '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
      setError(errorMsg);
      if (enableLogging) {
        authTestLogger.addLog('error', 'LOGIN_EXCEPTION', errorMsg, {
          errorType: err?.constructor?.name,
          errorMessage: err?.message,
        }, err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-neutral-950 rounded-lg shadow-xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-900">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            로그인
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

          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              이메일
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            계정이 없으신가요?{' '}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onSwitchToSignup) {
                  onSwitchToSignup();
                }
              }}
              className="text-primary hover:underline font-medium"
            >
              회원가입
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

