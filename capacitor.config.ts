import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moveit.app',
  appName: 'MOVE.IT',
  
  // Live Reload 방식: 기존 배포된 웹 URL을 WebView로 로드
  // SSR/API 라우트를 유지하면서 앱 업데이트 없이 웹 변경사항 즉시 반영
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://moveit-xi.vercel.app',
    cleartext: true,
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false,
    },
  },

  // Android 설정
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },

  // iOS 설정
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
};

export default config;
