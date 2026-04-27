"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 프로필 타입 정의
export interface UserProfile {
  id: string;
  nickname: string | null;
  name: string | null;
  name_en: string | null;
  email: string | null;
  phone: string | null;
  profile_image: string | null;
  role: 'SUPER_ADMIN' | 'ACADEMY_OWNER' | 'ACADEMY_MANAGER' | 'INSTRUCTOR' | 'USER';
  created_at: string;
  updated_at: string;
  /** 연결된 강사 프로필 id. 있으면 "내 수업 관리 (강사용)" 노출 및 대시보드 접근 가능 */
  instructor_id: string | null;
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  /** 프로필에 연결된 강사가 있으면 true. 마이페이지 카드·대시보드 접근에 사용 */
  isInstructor: boolean;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    nameEn?: string,
    phone?: string,
    nickname?: string
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  /**
   * B-4 (2026-04-27): Google OAuth 로그인·가입 통합 1버튼.
   * Supabase Auth → Providers → Google이 활성화되어 있어야 동작.
   * `redirectTo`로 returnTo 경로 전달 가능 (예: 결제 진입 후 복귀).
   */
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 타임아웃 래퍼: Promise에 최대 시간 제한 설정
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// 기본 프로필 생성 헬퍼
function createFallbackProfile(authUser: SupabaseUser): UserProfile {
  return {
    id: authUser.id,
    nickname: null,
    name: authUser.email?.split('@')[0] || null,
    name_en: null,
    email: authUser.email || null,
    phone: null,
    profile_image: null,
    role: 'USER',
    created_at: authUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    instructor_id: null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // 중복 실행 방지용 ref
  const initializedRef = useRef(false);
  const fetchProfileAbortRef = useRef<AbortController | null>(null);
  const profileFetchInFlightRef = useRef<string | null>(null);

  // 클라이언트에서만 Supabase 클라이언트 생성 (lazy initialization)
  const [supabase] = useState(() => {
    if (typeof window !== 'undefined') {
      return createClient();
    }
    return null;
  });

  // 서버 API로 프로필 조회 (RLS 우회, role·instructor_id 포함). Bearer 토큰 전달로 Capacitor/다른 포트에서도 인증.
  const fetchProfileFromApi = useCallback(async (): Promise<UserProfile | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const { fetchWithAuth } = await import('@/lib/api/auth-fetch');
      const res = await fetchWithAuth('/api/auth/profile', { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      const p = json?.profile;
      if (!p || typeof p.id !== 'string') return null;
      return {
        id: p.id,
        nickname: p.nickname ?? null,
        name: p.name ?? null,
        name_en: p.name_en ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        profile_image: p.profile_image ?? null,
        role: (p.role && ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER', 'INSTRUCTOR', 'USER'].includes(String(p.role).toUpperCase()))
          ? (String(p.role).toUpperCase() as UserProfile['role'])
          : 'USER',
        created_at: p.created_at ?? new Date().toISOString(),
        updated_at: p.updated_at ?? new Date().toISOString(),
        instructor_id: p.instructor_id ?? null,
      } as UserProfile;
    } catch {
      return null;
    }
  }, []);

  // 프로필 정보 가져오기 (비동기, 실패 시 API 폴백으로 role 정확히 반영)
  // 중복 호출 방지 및 타임아웃 포함
  const fetchProfile = useCallback(async (userId: string, authUser?: SupabaseUser) => {
    if (!supabase) return;

    // 이미 같은 userId에 대해 요청 중이면 스킵
    if (profileFetchInFlightRef.current === userId) return;
    profileFetchInFlightRef.current = userId;

    // 이전 요청 취소
    if (fetchProfileAbortRef.current) {
      fetchProfileAbortRef.current.abort();
    }
    fetchProfileAbortRef.current = new AbortController();

    const setFallbackOrApiProfile = async () => {
      const apiProfile = await fetchProfileFromApi();
      if (apiProfile) {
        setProfile(apiProfile);
        return;
      }
      if (authUser) {
        setProfile(createFallbackProfile(authUser));
      } else {
        setProfile(null);
      }
    };

    try {
      // API 우선: 세션 쿠키로 instructor_id·role 정확히 조회 (강사 카드 노출용)
      const apiProfile = await fetchProfileFromApi();
      if (apiProfile && apiProfile.id === userId) {
        setProfile(apiProfile);
        return;
      }

      const fetchPromise = Promise.resolve(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
      );

      const result = await withTimeout(
        fetchPromise,
        10000,
        { data: null, error: { message: 'Profile fetch timeout' } } as any
      );

      const { data, error } = result;

      if (error || !data) {
        console.warn('Profile not found or error (non-critical):', error);
        await setFallbackOrApiProfile();
        return;
      }
      const row = data as UserProfile & { role?: string };
      const validRoles = ['SUPER_ADMIN', 'ACADEMY_OWNER', 'ACADEMY_MANAGER', 'INSTRUCTOR', 'USER'] as const;
      const normalizedRole =
        row.role && validRoles.includes(String(row.role).toUpperCase() as typeof validRoles[number])
          ? (String(row.role).toUpperCase() as UserProfile['role'])
          : ('USER' as const);
      let instructorId: string | null = apiProfile?.instructor_id ?? (row as { instructor_id?: string }).instructor_id ?? null;
      if (!instructorId && supabase) {
        try {
          const { data: inst } = await supabase.from('instructors').select('id').eq('user_id', userId).maybeSingle() as { data: { id: string } | null };
          if (inst?.id) instructorId = inst.id;
        } catch {
          // ignore
        }
      }
      setProfile({
        ...row,
        role: normalizedRole,
        instructor_id: instructorId,
      });
    } catch (error) {
      console.warn('Error fetching profile (non-critical):', error);
      await setFallbackOrApiProfile();
    } finally {
      profileFetchInFlightRef.current = null;
    }
  }, [supabase, fetchProfileFromApi]);

  // 회원가입
  // P0-2 (2026-04-20): Distinguish Case B (legitimate existing member) from Case C
  // (orphan is_guest row). "already registered" now triggers a precheck; Case B surfaces
  // a friendly message prompting login, Case C would be auto-recovered by RPC v2 if the
  // user could complete signUp, but auth.users collision blocks that path — so Case C also
  // falls back to the same "please log in" guidance (the RPC recovery happens on the next
  // successful signUp retry from a different flow, e.g., admin cleanup).
  const signUp = useCallback(async (
    email: string,
    password: string,
    name: string,
    nameEn?: string,
    phone?: string,
    nickname?: string
  ) => {
    if (!supabase) {
      return { error: { message: '클라이언트가 초기화되지 않았습니다.' } };
    }
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        const msg = String(authError.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
          // Probe whether this email corresponds to a guest row we can merge on next attempt.
          let isGuest = false;
          try {
            const res = await fetch('/api/auth/precheck-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: normalizedEmail }),
            });
            if (res.ok) {
              const json = await res.json().catch(() => ({}));
              isGuest = !!json?.isGuest;
            }
          } catch {
            // Ignore probe errors — default to Case B messaging.
          }
          return {
            error: {
              message: isGuest
                ? '이미 가입 절차가 시작된 이메일입니다. 로그인해주세요.'
                : '이미 가입된 이메일입니다. 로그인해주세요.',
              code: 'ALREADY_REGISTERED',
            },
          };
        }
        return { error: authError };
      }

      if (!authData.user) {
        return { error: { message: '회원가입에 실패했습니다.' } };
      }

      const { error: profileError } = await (supabase as any).rpc('signup_with_guest_merge', {
        p_auth_id: authData.user.id,
        p_email: normalizedEmail,
        p_name: name,
        p_name_en: nameEn || null,
        p_phone: phone || null,
        p_nickname: nickname || null,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { error: profileError };
      }

      // 프로필 정보 가져오기 (비동기, 실패해도 계속 진행)
      fetchProfile(authData.user.id, authData.user).catch(() => {});

      // B-3 (2026-04-21): 비회원 시절 예약·결제 즉시 병합. my-page-view 진입 이전 경로
      // (예: 카드결제 success → /my/tickets 리다이렉트)에서도 Phase 1~4가 누락되지 않도록
      // 가입 직후 fire-and-forget 호출. 실패해도 my-page-view에서 한 번 더 시도됨.
      try {
        const { fetchWithAuth } = await import('@/lib/api/auth-fetch');
        fetchWithAuth('/api/me/link-guest-bookings', { method: 'POST' }).catch(() => {});
      } catch {
        // ignore
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, [supabase, fetchProfile]);

  // 로그인
  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: '클라이언트가 초기화되지 않았습니다.' } };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // signInWithPassword 직접 반환된 user 사용 (추가 getSession 불필요)
      if (data?.user) {
        setUser(data.user);
        fetchProfile(data.user.id, data.user).catch(() => {});

        // B-3 (2026-04-21): 가입 없이 로그인 복귀한 경우에도 비회원 예약 병합 필요
        // (기존 회원이 로그아웃한 채 비회원 결제 후 복귀 등). my-page-view 경유 없이
        // 즉시 실행해 success 화면 리다이렉트 경로에서도 최신 상태 반영.
        try {
          const { fetchWithAuth } = await import('@/lib/api/auth-fetch');
          fetchWithAuth('/api/me/link-guest-bookings', { method: 'POST' }).catch(() => {});
        } catch {
          // ignore
        }
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, [supabase, fetchProfile]);

  // B-4 (2026-04-27): Google OAuth 로그인·가입 통합.
  // Supabase Auth → Providers → Google이 활성화되어 있고 redirect URL이
  // `<origin>/auth/callback` 으로 등록되어 있어야 함.
  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    if (!supabase) return { error: new Error('Supabase client not initialized') };
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      // returnTo는 callback에서 query param으로 받아 최종 redirect 시 사용.
      const callback = `${origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback,
          // 강사·운영자 계정 OAuth로 들어와도 RLS는 users.role 기반으로 동작.
        },
      });
      if (error) return { error };
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, [supabase]);

  // 로그아웃
  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      // 먼저 상태 초기화 (UI 즉시 반영)
      setUser(null);
      setProfile(null);
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      // 에러가 발생해도 상태는 이미 초기화됨
    }
  }, [supabase, router]);

  // 프로필 새로고침
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 중복 초기화 방지
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 최대 8초 안전 타임아웃: 어떤 이유로든 loading이 풀리지 않는 것을 방지
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[AuthContext] Safety timeout: forcing loading=false after 8s');
          return false;
        }
        return prev;
      });
    }, 8000);

    // onAuthStateChange 리스너만 사용하여 초기 세션 + 변경 감지를 통합
    // Supabase v2+에서 onAuthStateChange는 INITIAL_SESSION 이벤트로 
    // 초기 세션도 전달하므로, 별도 checkSession() 호출이 불필요
    let isFirstEvent = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        // INITIAL_SESSION이거나 SIGNED_IN일 때 프로필 로드
        fetchProfile(session.user.id, session.user).catch(() => {});
      } else {
        setUser(null);
        setProfile(null);
      }

      // 첫 번째 이벤트(INITIAL_SESSION) 또는 auth 이벤트 시 로딩 해제
      if (isFirstEvent) {
        isFirstEvent = false;
        setLoading(false);
        clearTimeout(safetyTimer);
      }
      
      // TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT 등의 이벤트에서도 로딩 해제
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    // INITIAL_SESSION 이벤트가 발행되지 않는 경우를 대비한 폴백
    // (Supabase 버전에 따라 INITIAL_SESSION 미지원 가능)
    const fallbackTimer = setTimeout(async () => {
      if (isFirstEvent) {
        isFirstEvent = false;
        try {
          // getUser()로 서버 검증 (getSession()보다 안전)
          const { data: { user: verifiedUser } } = await withTimeout(
            supabase.auth.getUser(),
            5000,
            { data: { user: null }, error: null } as any
          );
          if (verifiedUser) {
            setUser(verifiedUser);
            fetchProfile(verifiedUser.id, verifiedUser).catch(() => {});
          }
        } catch (e) {
          console.warn('[AuthContext] Fallback session check failed:', e);
        } finally {
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
      clearTimeout(fallbackTimer);
      if (fetchProfileAbortRef.current) {
        fetchProfileAbortRef.current.abort();
      }
      // Strict Mode 재마운트 시 리스너가 다시 등록되도록
      initializedRef.current = false;
    };
  }, [supabase, fetchProfile]);

  const value: AuthContextType = {
    user,
    profile,
    isInstructor: !!profile?.instructor_id,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

