/**
 * Capacitor 푸시 알림 관리 유틸리티
 * FCM(Android) / APNs(iOS) 네이티브 푸시 알림 처리
 */

import { PushNotifications, type Token, type ActionPerformed, type PushNotificationSchema } from '@capacitor/push-notifications';
import { isNativePlatform, isPluginAvailable } from './platform';

export interface PushNotificationCallbacks {
  /** 디바이스 토큰 등록 성공 시 */
  onRegistration?: (token: string) => void;
  /** 디바이스 토큰 등록 실패 시 */
  onRegistrationError?: (error: string) => void;
  /** 앱이 포그라운드일 때 알림 수신 */
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  /** 사용자가 알림을 탭했을 때 */
  onNotificationActionPerformed?: (action: ActionPerformed) => void;
}

/**
 * 푸시 알림 권한 요청 및 등록
 * @returns 토큰 문자열 또는 null (웹 환경이거나 실패 시)
 */
export async function registerPushNotifications(
  callbacks?: PushNotificationCallbacks
): Promise<string | null> {
  if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) {
    console.log('[Push] 네이티브 환경이 아니므로 푸시 등록을 건너뜁니다.');
    return null;
  }

  try {
    // 권한 확인
    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive === 'prompt') {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== 'granted') {
      console.log('[Push] 푸시 알림 권한이 거부되었습니다.');
      return null;
    }

    // 리스너 등록
    return new Promise((resolve) => {
      // 토큰 등록 성공
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('[Push] 토큰 등록 성공:', token.value);
        callbacks?.onRegistration?.(token.value);
        resolve(token.value);
      });

      // 토큰 등록 실패
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] 토큰 등록 실패:', error);
        callbacks?.onRegistrationError?.(JSON.stringify(error));
        resolve(null);
      });

      // 포그라운드 알림 수신
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] 알림 수신:', notification);
        callbacks?.onNotificationReceived?.(notification);
      });

      // 알림 탭 액션
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] 알림 액션:', action);
        callbacks?.onNotificationActionPerformed?.(action);
      });

      // FCM/APNs 등록 시작
      PushNotifications.register();
    });
  } catch (error) {
    console.error('[Push] 푸시 등록 중 오류:', error);
    return null;
  }
}

/**
 * 푸시 알림 리스너 모두 제거
 */
export async function removeAllPushListeners(): Promise<void> {
  if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) return;
  await PushNotifications.removeAllListeners();
}

/**
 * 수신된 알림 목록 가져오기 (알림 센터에 표시된 것들)
 */
export async function getDeliveredNotifications() {
  if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) return [];
  const result = await PushNotifications.getDeliveredNotifications();
  return result.notifications;
}

/**
 * 수신된 알림 모두 제거 (알림 센터에서)
 */
export async function removeAllDeliveredNotifications(): Promise<void> {
  if (!isNativePlatform() || !isPluginAvailable('PushNotifications')) return;
  await PushNotifications.removeAllDeliveredNotifications();
}
