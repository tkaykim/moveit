"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { authFetch } from '@/lib/supabase/auth-fetch';

interface PushNotificationContextType {
  deviceToken: string | null;
  isSupported: boolean;
  permissionGranted: boolean;
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  /** 디버그 정보 (임시) */
  debugInfo: string;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  deviceToken: null,
  isSupported: false,
  permissionGranted: false,
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  requestPermission: async () => false,
  debugInfo: '',
});

export function usePushNotification() {
  return useContext(PushNotificationContext);
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { user } = useAuth();
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState('init');
  const initRef = useRef(false);
  const tokenSyncRef = useRef<string | null>(null);

  /** 알림 탭 시 path(앱 내 경로) 또는 url(외부 링크)로 이동 */
  const handleNotificationAction = useCallback((data: Record<string, any>) => {
    if (!data || typeof data !== 'object') return;
    const path = data.path;
    const url = data.url;
    if (path && typeof path === 'string') {
      const route = path.startsWith('/') ? path : `/${path}`;
      routerRef.current?.push(route);
    } else if (url && typeof url === 'string') {
      if (url.startsWith('http')) window.open(url, '_blank');
      else routerRef.current?.push(url.startsWith('/') ? url : `/${url}`);
    }
  }, []);

  const log = useCallback((msg: string) => {
    console.log('[Push]', msg);
    setDebugInfo(prev => prev + '\n' + msg);
  }, []);

  // 서버에 토큰 등록
  const saveTokenToServer = useCallback(async (token: string) => {
    try {
      const cap = (window as any).Capacitor;
      const platform = cap?.getPlatform?.() || 'unknown';
      const res = await authFetch('/api/notifications/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform }),
      });
      if (res.ok) {
        console.log('[Push] 토큰 서버 등록 완료');
      }
    } catch (error) {
      console.error('[Push] 토큰 서버 등록 오류:', error);
    }
  }, []);

  // 방법1: @capacitor/push-notifications npm 패키지 사용
  const tryNpmPackage = useCallback(async (): Promise<boolean> => {
    log('npm 패키지 시도...');
    try {
      const mod = await import('@capacitor/push-notifications');
      const PN = mod.PushNotifications;
      log('PushNotifications import 성공');

      let permStatus = await PN.checkPermissions();
      log('권한 상태: ' + permStatus.receive);

      if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
        permStatus = await PN.requestPermissions();
        log('권한 요청 결과: ' + permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        log('권한 거부됨');
        return false;
      }

      setPermissionGranted(true);

      await PN.removeAllListeners();
      PN.addListener('registration', (token) => {
        log('FCM 토큰 획득: ' + token.value.substring(0, 20) + '...');
        setDeviceToken(token.value);
        saveTokenToServer(token.value);
      });
      PN.addListener('registrationError', (err) => {
        log('FCM 등록 오류: ' + JSON.stringify(err));
      });
      PN.addListener('pushNotificationReceived', (notif) => {
        log('포그라운드 알림: ' + JSON.stringify(notif.title));
        setUnreadCount(prev => prev + 1);
      });
      PN.addListener('pushNotificationActionPerformed', (action: any) => {
        const data = action?.notification?.data ?? {};
        handleNotificationAction(data);
      });

      await PN.register();
      log('FCM register() 호출 완료');
      return true;
    } catch (error: any) {
      log('npm 패키지 실패: ' + (error?.message || String(error)));
      return false;
    }
  }, [log, saveTokenToServer, handleNotificationAction]);

  // 방법2: window.Capacitor 브릿지 직접 호출
  const tryDirectBridge = useCallback(async (): Promise<boolean> => {
    log('직접 브릿지 시도...');
    try {
      const cap = (window as any).Capacitor;
      if (!cap) {
        log('window.Capacitor 없음');
        return false;
      }

      // Capacitor 브릿지의 nativeCallback 또는 Plugins 접근
      let PN: any = null;

      // 방법 2a: Capacitor.Plugins 접근
      if (cap.Plugins?.PushNotifications) {
        PN = cap.Plugins.PushNotifications;
        log('Plugins.PushNotifications 발견');
      }

      // 방법 2b: registerPlugin 직접 호출
      if (!PN && cap.registerPlugin) {
        log('registerPlugin으로 직접 등록...');
        PN = cap.registerPlugin('PushNotifications');
      }

      if (!PN) {
        log('PushNotifications 플러그인 찾을 수 없음');
        log('Capacitor keys: ' + Object.keys(cap).join(', '));
        if (cap.Plugins) {
          log('Plugins keys: ' + Object.keys(cap.Plugins).join(', '));
        }
        return false;
      }

      const permStatus = await PN.requestPermissions();
      log('직접 브릿지 권한 결과: ' + JSON.stringify(permStatus));

      if (permStatus.receive === 'granted') {
        setPermissionGranted(true);

        // 리스너 설정
        if (typeof PN.addListener === 'function') {
          PN.addListener('registration', (token: any) => {
            const val = token?.value || token;
            log('직접 브릿지 토큰: ' + String(val).substring(0, 20) + '...');
            setDeviceToken(String(val));
            saveTokenToServer(String(val));
          });
          PN.addListener('pushNotificationActionPerformed', (action: any) => {
            const data = action?.notification?.data ?? {};
            handleNotificationAction(data);
          });
        }

        await PN.register();
        log('직접 브릿지 register() 완료');
        return true;
      }

      return false;
    } catch (error: any) {
      log('직접 브릿지 실패: ' + (error?.message || String(error)));
      return false;
    }
  }, [log, saveTokenToServer, handleNotificationAction]);

  // 통합 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const cap = (window as any).Capacitor;
    const isNative = cap && (
      (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
      cap.isNativePlatform === true ||
      (cap.getPlatform?.() === 'android' || cap.getPlatform?.() === 'ios')
    );

    log('requestPermission - isNative: ' + isNative);
    log('platform: ' + cap?.getPlatform?.());

    if (!isNative) return false;

    // 방법1 시도
    const npm = await tryNpmPackage();
    if (npm) return true;

    // 방법2 시도
    const direct = await tryDirectBridge();
    if (direct) return true;

    log('모든 방법 실패');
    return false;
  }, [log, tryNpmPackage, tryDirectBridge]);

  // 앱 시작 시 자동 초기화
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const attemptInit = async () => {
      const cap = (window as any).Capacitor;
      log('초기화 시작');
      log('window.Capacitor: ' + (cap ? 'exists' : 'null'));
      log('androidBridge: ' + !!(window as any).androidBridge);

      if (cap) {
        log('isNativePlatform: ' + cap.isNativePlatform?.());
        log('getPlatform: ' + cap.getPlatform?.());
        log('isPluginAvailable: ' + cap.isPluginAvailable?.('PushNotifications'));
        log('Capacitor keys: ' + Object.keys(cap).join(','));
      }

      const isNative = cap && (
        (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
        cap.isNativePlatform === true ||
        (cap.getPlatform?.() === 'android' || cap.getPlatform?.() === 'ios')
      );

      if (!isNative) {
        log('네이티브 아님 - 종료');
        setIsSupported(false);
        return;
      }

      setIsSupported(true);
      await requestPermission();
    };

    // Capacitor 브릿지가 아직 없을 수 있으므로 폴링
    const poll = (attempt: number) => {
      if ((window as any).Capacitor) {
        attemptInit();
      } else if (attempt < 20) {
        // 최대 4초까지 200ms 간격으로 폴링
        setTimeout(() => poll(attempt + 1), 200);
      } else {
        // 브라우저 등 비-Capacitor 환경에서는 정상 동작. 콘솔 오류 대신 debug만 출력
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[Push] Capacitor 환경이 아님 (브라우저 또는 브릿지 미준비)');
        }
        setIsSupported(false);
      }
    };

    poll(0);
  }, [requestPermission, log]);

  // 로그인 시 토큰 연결
  useEffect(() => {
    if (!deviceToken || !user) return;
    if (tokenSyncRef.current === user.id) return;
    tokenSyncRef.current = user.id;
    saveTokenToServer(deviceToken);
  }, [user, deviceToken, saveTokenToServer]);

  // 읽지 않은 알림 수
  const refreshUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    try {
      const res = await authFetch('/api/notifications?unread_count=true');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (user) refreshUnreadCount();
    else setUnreadCount(0);
  }, [user, refreshUnreadCount]);

  return (
    <PushNotificationContext.Provider
      value={{ deviceToken, isSupported, permissionGranted, unreadCount, refreshUnreadCount, requestPermission, debugInfo }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}
