"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // 클라이언트에서만 Supabase 클라이언트 생성 (lazy initialization)
  const [supabase] = useState(() => {
    if (typeof window !== 'undefined') {
      return createClient();
    }
    return null;
  });

  // 프로필 정보 가져오기 (비동기, 실패해도 앱은 정상 작동)
  const fetchProfile = async (userId: string, authUser?: SupabaseUser) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // 프로필이 없어도 앱은 정상 작동하도록 에러만 로그
        console.warn('Profile not found or error (non-critical):', error);
        // user 정보로 기본 프로필 생성 (이미 있는 user 사용)
        if (authUser) {
          setProfile({
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
          });
        } else {
          // user가 없으면 null로 설정 (앱은 계속 작동)
          setProfile(null);
        }
        return;
      }
      setProfile(data as UserProfile);
    } catch (error) {
      // 프로필 가져오기 실패해도 앱은 정상 작동
      console.warn('Error fetching profile (non-critical):', error);
      // user 정보로 기본 프로필 생성
      if (authUser) {
        setProfile({
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
        });
      } else {
        setProfile(null);
      }
    }
  };

  // 초기 세션 확인
  const checkSession = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        // 프로필은 비동기로 가져오고, 실패해도 앱은 계속 작동
        fetchProfile(session.user.id, session.user).catch(() => {
          // 프로필 로딩 실패는 무시 (앱은 계속 작동)
        });
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  // 회원가입
  const signUp = async (
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
      // 1. Supabase Auth에 계정 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return { error: authError };
      }

      if (!authData.user) {
        return { error: { message: '회원가입에 실패했습니다.' } };
      }

      // 2. public.users 테이블에 프로필 생성
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

      // 3. 프로필 정보 가져오기 (비동기, 실패해도 계속 진행)
      fetchProfile(authData.user.id, authData.user).catch(() => {
        // 프로필 로딩 실패는 무시 (앱은 계속 작동)
      });

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  // 로그인
  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: { message: '클라이언트가 초기화되지 않았습니다.' } };
    }
    try {
      // 1. 이메일/비밀번호로 인증
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // 2. 세션 확인 후 프로필 가져오기 (비동기, 실패해도 계속 진행)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user).catch(() => {
          // 프로필 로딩 실패는 무시 (앱은 계속 작동)
        });
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  // 로그아웃
  const signOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // 프로필 새로고침
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 초기 세션 확인
    checkSession();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        // 프로필은 비동기로 가져오고, 실패해도 앱은 계속 작동
        fetchProfile(session.user.id, session.user).catch(() => {
          // 프로필 로딩 실패는 무시 (앱은 계속 작동)
        });
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

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

