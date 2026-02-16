/**
 * Capacitor 유틸리티 진입점
 */

export {
  getPlatform,
  isNativePlatform,
  isAndroid,
  isIOS,
  isWeb,
  isPluginAvailable,
  type Platform,
} from './platform';

export {
  registerPushNotifications,
  removeAllPushListeners,
  getDeliveredNotifications,
  removeAllDeliveredNotifications,
  type PushNotificationCallbacks,
} from './push-notifications';
