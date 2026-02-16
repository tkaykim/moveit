"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface PushNotificationContextType {
  deviceToken: string | null;
  isSupported: boolean;
  permissionGranted: boolean;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  /** 푸시 알림 권한 요청 (설정 페이지에서 호출) */
  requestPermission: () => Promise<boolean>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  deviceToken: null,
  isSupported: false,
  permissionGranted: false,
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  requestPermission: async () => false,
});

export function usePushNotification() {
  return useContext(PushNotificationContext);
}

/** Capacitor 네이티브 앱인지 직접 감지 (window.Capacitor 확인) */
function detectNativePlatform(): { isNative: boolean; platform: string } {
  if (typeof window === 'undefined') return { isNative: false, platform: 'web' };

  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return { isNative: true, platform: cap.getPlatform?.() || 'native' };
  }
  if (cap && cap.isNativePlatform === true) {
    return { isNative: true, platform: cap.getPlatform?.() || 'native' };
  }
  return { isNative: false, platform: 'web' };
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const initAttemptedRef = useRef(false);
  const tokenSyncedRef = useRef<string | null>(null);

  // 서버에 토큰 등록
  const saveTokenToServer = useCallback(async (token: string) => {
    try {
      const { platform } = detectNativePlatform();
      const res = await fetch('/api/notifications/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      });
      if (res.ok) {
        console.log('[Push] 토큰 서버 등록 완료');
      } else {
        console.error('[Push] 토큰 서버 등록 실패:', await res.text());
      }
    } catch (error) {
      console.error('[Push] 토큰 서버 등록 오류:', error);
    }
  }, []);

  // 푸시 알림 권한 요청 + 토큰 등록
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { isNative } = detectNativePlatform();
    console.log('[Push] requestPermission called, isNative:', isNative);

    if (!isNative) {
      console.log('[Push] 네이티브 환경이 아님 - 건너뜀');
      return false;
    }

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // 권한 확인
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push] 현재 권한 상태:', permStatus.receive);

      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push] 권한 요청 결과:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        console.log('[Push] 권한 거부됨');
        setPermissionGranted(false);
        return false;
      }

      setPermissionGranted(true);

      // 리스너 등록 + FCM 등록
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', (token) => {
        console.log('[Push] FCM 토큰 획득:', token.value.substring(0, 20) + '...');
        setDeviceToken(token.value);
        saveTokenToServer(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] FCM 등록 실패:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] 포그라운드 알림 수신:', notification);
        setUnreadCount((prev) => prev + 1);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] 알림 탭:', action);
        const data = action.notification.data;
        if (data?.url && typeof window !== 'undefined') {
          window.location.href = data.url;
        }
      });

      await PushNotifications.register();
      console.log('[Push] FCM register() 호출 완료');
      return true;
    } catch (error) {
      console.error('[Push] 권한 요청 오류:', error);
      return false;
    }
  }, [saveTokenToServer]);

  // 앱 시작 시 자동 초기화
  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    // Capacitor 브릿지 로딩 대기 후 초기화
    const tryInit = () => {
      const { isNative, platform } = detectNativePlatform();
      console.log('[Push] 플랫폼 감지:', { isNative, platform });

      if (isNative) {
        setIsSupported(true);
        requestPermission();
      } else {
        setIsSupported(false);
      }
    };

    // Capacitor 브릿지가 아직 로드되지 않았을 수 있으므로 약간 대기
    if ((window as any).Capacitor) {
      tryInit();
    } else {
      // 500ms 후 재시도
      const timer = setTimeout(tryInit, 500);
      return () => clearTimeout(timer);
    }
  }, [requestPermission]);

  // 로그인 시 토큰에 user_id 연결
  useEffect(() => {
    if (!deviceToken || !user) return;
    if (tokenSyncedRef.current === user.id) return;

    tokenSyncedRef.current = user.id;
    saveTokenToServer(deviceToken);
  }, [user, deviceToken, saveTokenToServer]);

  // 읽지 않은 알림 수 조회
  const refreshUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    try {
      const res = await fetch('/api/notifications?unread_count=true');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('[Push] 알림 수 조회 실패:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshUnreadCount();
    else setUnreadCount(0);
  }, [user, refreshUnreadCount]);

  return (
    <PushNotificationContext.Provider
      value={{
        deviceToken,
        isSupported,
        permissionGranted,
        unreadCount,
        refreshUnreadCount,
        requestPermission,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}
