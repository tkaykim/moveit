'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  phone: string | null;
  profile_image: string | null;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, name?: string, nickname?: string, phone?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const supabase = createClient();

  // 세션 확인 및 사용자 정보 로드
  const loadUser = async () => {
    // 중복 호출 방지
    if (isLoadingUser) {
      console.log('loadUser: 이미 로딩 중이므로 건너뜀');
      return;
    }
    
    setIsLoadingUser(true);
    try {
      console.log('loadUser: 사용자 정보 가져오기 시작');
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        console.warn('loadUser: 사용자 정보 가져오기 실패:', userError);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentUser) {
        console.log('loadUser: 사용자 확인됨:', currentUser.id, currentUser.email);
        setUser(currentUser);

        // 프로필 정보 가져오기 (에러가 발생해도 계속 진행)
        try {
          console.log('loadUser: 프로필 정보 조회 시작');
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (profileError) {
            console.warn('loadUser: 프로필 정보 가져오기 실패:', {
              code: profileError.code,
              message: profileError.message,
              details: profileError.details,
              hint: profileError.hint,
            });
            // 프로필이 없어도 사용자는 있으므로 계속 진행
            // 기본 프로필 설정
            setProfile({
              id: currentUser.id,
              email: currentUser.email || null,
              name: null,
              nickname: null,
              phone: null,
              profile_image: null,
            } as UserProfile);
          } else if (profileData) {
            const typedProfileData = profileData as UserProfile;
            console.log('loadUser: 프로필 정보 로드 성공:', {
              id: typedProfileData.id,
              email: typedProfileData.email,
              name: typedProfileData.name,
              role: typedProfileData.role || '없음',
              hasRole: !!typedProfileData.role,
            });
            setProfile(typedProfileData);
          } else {
            console.warn('loadUser: 프로필 데이터가 null');
            // 기본 프로필 설정
            setProfile({
              id: currentUser.id,
              email: currentUser.email || null,
              name: null,
              nickname: null,
              phone: null,
              profile_image: null,
            } as UserProfile);
          }
        } catch (profileError: any) {
          console.warn('loadUser: 프로필 조회 중 예외 발생:', {
            message: profileError?.message,
            stack: profileError?.stack,
          });
          // 프로필 조회 실패해도 계속 진행
          // 기본 프로필 설정
          setProfile({
            id: currentUser.id,
            email: currentUser.email || null,
            name: null,
            nickname: null,
            phone: null,
            profile_image: null,
          } as UserProfile);
        }
      } else {
        console.log('loadUser: 사용자가 없음');
        setUser(null);
        setProfile(null);
      }
    } catch (error: any) {
      console.error('loadUser: 사용자 정보 로드 실패:', {
        message: error?.message,
        stack: error?.stack,
      });
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
      setIsLoadingUser(false);
      console.log('loadUser: 완료');
    }
  };

  // 초기 로드 및 세션 변경 감지
  useEffect(() => {
    loadUser();

    // Auth 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadUser();
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 회원가입
  const signUp = async (
    email: string,
    password: string,
    name?: string,
    nickname?: string,
    phone?: string
  ) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name?.trim() || undefined,
          nickname: nickname?.trim() || undefined,
          phone: phone?.trim() || undefined,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('응답 JSON 파싱 실패:', jsonError);
        return { error: '서버 응답을 처리할 수 없습니다.' };
      }

      if (!response.ok) {
        console.error('회원가입 API 에러:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details,
        });
        return { error: data.error || `회원가입에 실패했습니다. (${response.status})` };
      }

      // 회원가입 성공 시 사용자 정보 다시 로드
      await loadUser();

      return {};
    } catch (error: any) {
      console.error('회원가입 네트워크 에러:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { error: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' };
      }
      return { error: error.message || '예기치 않은 오류가 발생했습니다.' };
    }
  };

  // 로그인
  const signIn = async (email: string, password: string) => {
    try {
      console.log('로그인 시작:', email);
      
      // 서버 API를 통해 로그인 (쿠키는 서버에서 설정됨)
      console.log('서버 로그인 API 호출 시작...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password 
        }),
        credentials: 'include', // 쿠키 포함
      });

      console.log('서버 로그인 API 응답:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('응답 JSON 파싱 실패:', jsonError);
        return { error: '서버 응답을 처리할 수 없습니다.' };
      }

      if (!response.ok) {
        console.error('로그인 API 에러:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
        });
        return { error: data.error || `로그인에 실패했습니다. (${response.status})` };
      }

      console.log('서버 로그인 성공:', {
        userId: data.user?.id,
        email: data.user?.email,
        hasProfile: !!data.profile,
      });

      // 로그인 성공 시 사용자 정보 다시 로드
      console.log('사용자 정보 로드 시작...');
      try {
        await loadUser();
        console.log('사용자 정보 로드 완료');
      } catch (loadError: any) {
        console.error('사용자 정보 로드 실패 (로그인은 성공):', {
          message: loadError?.message,
          stack: loadError?.stack,
        });
        // 로드 실패해도 로그인은 성공한 것으로 처리
      }

      console.log('로그인 프로세스 완료');
      return {};
    } catch (error: any) {
      console.error('로그인 네트워크 에러:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return { error: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' };
      }
      return { error: error.message || '예기치 않은 오류가 발생했습니다.' };
    }
  };

  // 로그아웃
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  // 세션 새로고침
  const refreshSession = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

