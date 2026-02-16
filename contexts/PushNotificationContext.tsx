"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase/client';

interface PushNotificationContextType {
  /** 현재 디바이스의 FCM 토큰 */
  deviceToken: string | null;
  /** 푸시 알림이 지원되는 환경인지 */
  isSupported: boolean;
  /** 푸시 알림 권한 상태 */
  permissionGranted: boolean;
  /** 읽지 않은 알림 수 */
  unreadCount: number;
  /** 읽지 않은 알림 수 새로고침 */
  refreshUnreadCount: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  deviceToken: null,
  isSupported: false,
  permissionGranted: false,
  unreadCount: 0,
  refreshUnreadCount: async () => {},
});

export function usePushNotification() {
  return useContext(PushNotificationContext);
}

interface PushNotificationProviderProps {
  children: ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user } = useAuth();
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const registeredRef = useRef(false);
  const tokenSavedForUserRef = useRef<string | null>(null);

  // 푸시 알림 초기화 (네이티브 환경에서만)
  useEffect(() => {
    let mounted = true;

    async function initPush() {
      try {
        // 동적 임포트로 Capacitor 모듈 로드 (SSR 방지)
        const { isNativePlatform, isPluginAvailable } = await import('@/lib/capacitor/platform');

        if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) {
          if (mounted) setIsSupported(false);
          return;
        }

        if (mounted) setIsSupported(true);

        // 이미 등록된 경우 건너뜀
        if (registeredRef.current) return;
        registeredRef.current = true;

        const { registerPushNotifications } = await import('@/lib/capacitor/push-notifications');

        const token = await registerPushNotifications({
          onRegistration: (t) => {
            if (mounted) {
              setDeviceToken(t);
              setPermissionGranted(true);
            }
          },
          onRegistrationError: (err) => {
            console.error('[PushProvider] 등록 실패:', err);
            if (mounted) setPermissionGranted(false);
          },
          onNotificationReceived: (notification) => {
            console.log('[PushProvider] 포그라운드 알림:', notification);
            // 읽지 않은 알림 수 증가
            if (mounted) {
              setUnreadCount((prev) => prev + 1);
            }
          },
          onNotificationActionPerformed: (action) => {
            console.log('[PushProvider] 알림 탭:', action);
            // 알림 탭 시 해당 페이지로 네비게이션 (data에서 URL 추출)
            const data = action.notification.data;
            if (data?.url && typeof window !== 'undefined') {
              window.location.href = data.url;
            }
          },
        });

        if (mounted && token) {
          setDeviceToken(token);
          setPermissionGranted(true);
        }
      } catch (error) {
        console.error('[PushProvider] 초기화 오류:', error);
      }
    }

    initPush();

    return () => {
      mounted = false;
    };
  }, []);

  // 토큰 획득 즉시 서버에 등록 (비로그인도 가능)
  useEffect(() => {
    if (!deviceToken) return;

    async function registerTokenImmediately() {
      try {
        const { getPlatform } = await import('@/lib/capacitor/platform');
        const platform = getPlatform();

        const response = await fetch('/api/notifications/device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: deviceToken, platform }),
        });

        if (response.ok) {
          tokenSavedForUserRef.current = 'anonymous';
          console.log('[PushProvider] 토큰 서버 등록 완료 (앱 시작)');
        }
      } catch (error) {
        console.error('[PushProvider] 토큰 서버 등록 실패:', error);
      }
    }

    registerTokenImmediately();
  }, [deviceToken]);

  // 로그인/로그아웃 시 토큰에 user_id 연결/해제
  useEffect(() => {
    if (!deviceToken) return;

    async function syncUserWithToken() {
      const { getPlatform } = await import('@/lib/capacitor/platform');
      const platform = getPlatform();

      if (user) {
        if (tokenSavedForUserRef.current === user.id) return;

        try {
          const response = await fetch('/api/notifications/device-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: deviceToken, platform }),
          });

          if (response.ok) {
            tokenSavedForUserRef.current = user.id;
            console.log('[PushProvider] 토큰-유저 연결 완료');
          }
        } catch (error) {
          console.error('[PushProvider] 토큰-유저 연결 실패:', error);
        }
      }
    }

    syncUserWithToken();
  }, [user, deviceToken]);

  // 읽지 않은 알림 수 조회
  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch('/api/notifications?unread_count=true');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('[PushProvider] 알림 수 조회 실패:', error);
    }
  }, [user]);

  // 로그인 시 읽지 않은 알림 수 조회
  useEffect(() => {
    if (user) {
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [user, refreshUnreadCount]);

  return (
    <PushNotificationContext.Provider
      value={{
        deviceToken,
        isSupported,
        permissionGranted,
        unreadCount,
        refreshUnreadCount,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}
