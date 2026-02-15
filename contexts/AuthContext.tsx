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
}

interface AuthContextType {
  user: SupabaseUser | null;
  profile: UserProfile | null;
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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 프로필 중복 fetch 방지
  const profileFetchIdRef = useRef<string | null>(null);

  // 클라이언트에서만 Supabase 클라이언트 생성 (싱글톤)
  const [supabase] = useState(() => {
    if (typeof window !== 'undefined') {
      return createClient();
    }
    return null;
  });

  // 프로필 정보 가져오기 (비동기, 실패해도 앱은 정상 작동)
  const fetchProfile = useCallback(async (userId: string, authUser?: SupabaseUser) => {
    if (!supabase) return;

    // 같은 userId에 대해 이미 fetch 중이면 스킵
    if (profileFetchIdRef.current === userId) return;
    profileFetchIdRef.current = userId;

    try {
      // 타임아웃 포함 프로필 조회
      const fetchPromise = Promise.resolve(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
      );

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Profile fetch timeout (8s)' } }), 8000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error || !data) {
        console.warn('Profile not found or error (non-critical):', error);
        if (authUser) {
          setProfile(createFallbackProfile(authUser));
        } else {
          setProfile(null);
        }
        return;
      }
      setProfile(data as UserProfile);
    } catch (error) {
      console.warn('Error fetching profile (non-critical):', error);
      if (authUser) {
        setProfile(createFallbackProfile(authUser));
      } else {
        setProfile(null);
      }
    } finally {
      profileFetchIdRef.current = null;
    }
  }, [supabase]);

  // 회원가입
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
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) return { error: authError };
      if (!authData.user) return { error: { message: '회원가입에 실패했습니다.' } };

      const userData: Database['public']['Tables']['users']['Insert'] = {
        id: authData.user.id,
        email: email,
        name: name,
        name_en: nameEn || null,
        phone: phone || null,
        nickname: nickname || null,
        role: 'USER',
      };
      const { error: profileError } = await supabase
        .from('users')
        .insert([userData] as any);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { error: profileError };
      }

      fetchProfile(authData.user.id, authData.user).catch(() => {});
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

      if (error) return { error };

      // signInWithPassword가 직접 반환한 user 사용
      if (data?.user) {
        setUser(data.user);
        fetchProfile(data.user.id, data.user).catch(() => {});
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }, [supabase, fetchProfile]);

  // 로그아웃
  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      setUser(null);
      setProfile(null);
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [supabase, router]);

  // 프로필 새로고침
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  }, [user, fetchProfile]);

  // =====================================================
  // 핵심 초기화 로직
  // React StrictMode에서도 안전하게 동작하도록 설계:
  // - initializedRef 같은 중복 방지 ref를 사용하지 않음
  // - cleanup 후 재마운트 시에도 정상적으로 리스너가 등록됨
  // - getSession()으로 즉시 초기 상태를 설정하고,
  //   onAuthStateChange로 이후 변경을 추적
  // =====================================================
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // 1) 안전 타임아웃: 어떤 이유로든 3초 안에 loading이 안 풀리면 강제 해제
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
      }
    }, 3000);

    // 2) getSession()으로 즉시 초기 상태 확인 (로컬 스토리지에서 읽음 → 빠름)
    //    이것만으로도 loading을 해제하기에 충분
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user).catch(() => {});
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      clearTimeout(safetyTimer);
    }).catch((err) => {
      console.warn('[AuthContext] getSession failed:', err);
      if (!cancelled) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    });

    // 3) onAuthStateChange로 이후 세션 변경 감지
    //    (로그인, 로그아웃, 토큰 갱신, 초기 세션 등)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user).catch(() => {});
      } else {
        setUser(null);
        setProfile(null);
      }
      // 모든 auth 이벤트에서 loading 해제 보장
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signUp,
    signIn,
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
