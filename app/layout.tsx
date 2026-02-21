import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { CapacitorSafeArea } from "@/components/common/capacitor-safe-area";
import { PaymentWindowOverride } from "@/lib/capacitor/payment-window-override";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: "MOVE.IT - 댄스 학원 강사 플랫폼",
  description: "댄스 학원, 강사, 수강 클래스를 찾고 예약하는 플랫폼",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Critical CSS - 레이아웃 깨짐 방지 */
            html { visibility: hidden; }
            html.css-loaded { visibility: visible; }
            body { margin: 0; padding: 0; }
            * { box-sizing: border-box; }
          `
        }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // CSS 로딩 확인
                function checkCSSLoaded() {
                  if (document.styleSheets.length > 0) {
                    document.documentElement.classList.add('css-loaded');
                    return true;
                  }
                  return false;
                }
                if (checkCSSLoaded()) {} else {
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                      setTimeout(function() { if (!checkCSSLoaded()) document.documentElement.classList.add('css-loaded'); }, 100);
                    });
                  } else {
                    setTimeout(function() { if (!checkCSSLoaded()) document.documentElement.classList.add('css-loaded'); }, 100);
                  }
                }
                setTimeout(function() { document.documentElement.classList.add('css-loaded'); }, 3000);

                // Capacitor 브릿지 조기 감지 및 푸시 알림 초기화
                window.__PUSH_DEBUG = [];
                function pushLog(msg) {
                  window.__PUSH_DEBUG.push(new Date().toLocaleTimeString() + ': ' + msg);
                  console.log('[EarlyPush] ' + msg);
                }
                
                function tryEarlyPush() {
                  var cap = window.Capacitor;
                  pushLog('cap=' + (cap ? 'Y' : 'N'));
                  if (!cap) return false;
                  
                  pushLog('platform=' + (cap.getPlatform ? cap.getPlatform() : 'unknown'));
                  pushLog('isNative=' + (cap.isNativePlatform ? cap.isNativePlatform() : 'unknown'));
                  pushLog('bridge=' + (!!window.androidBridge));
                  
                  var isNative = false;
                  try {
                    isNative = typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNativePlatform === true;
                  } catch(e) { pushLog('detect err: ' + e.message); }
                  
                  if (!isNative) {
                    pushLog('not native');
                    return false;
                  }
                  
                  pushLog('NATIVE OK - plugin avail=' + (cap.isPluginAvailable ? cap.isPluginAvailable('PushNotifications') : '?'));
                  window.__CAPACITOR_IS_NATIVE = true;
                  return true;
                }
                
                // 즉시 시도
                if (!tryEarlyPush()) {
                  // 200ms 간격으로 재시도 (최대 3초)
                  var attempts = 0;
                  var timer = setInterval(function() {
                    attempts++;
                    if (tryEarlyPush() || attempts >= 15) {
                      clearInterval(timer);
                      if (attempts >= 15) pushLog('timeout - cap not found');
                    }
                  }, 200);
                }
              })();
            `
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <PushNotificationProvider>
              <CapacitorSafeArea />
              <PaymentWindowOverride />
              {children}
            </PushNotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

